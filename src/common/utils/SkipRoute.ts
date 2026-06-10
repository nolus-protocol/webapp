import type { Chain, RouteRequest, RouteResponse, MessagesRequest, MessagesResponse } from "../types/skipRoute";
import type { SkipMsg } from "@/common/api/types/swap";

import { fetchNetworkStatus } from "./ConfigService";
import { assertChainList, assertRouteResponse, assertMessagesResponse } from "./skipResponseGuards";
import { BackendApi } from "@/common/api";
import { i18n } from "@/i18n";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

/** Result of simulateMultiTx — contains the transaction data */
export interface SkipTxResult {
  txHash: string;
  txBytes: Uint8Array;
  [key: string]: unknown;
}

/** Status response from Skip transaction tracking */
interface SkipTransactionStatus {
  state: string;
  error: string;
}

// NolusWallet declares simulateMultiTx as private, so no public structural type
// can require it even though every wallet handed to submitRoute carries it at
// runtime — narrow per wallet at the call site instead.
function canSimulateMultiTx<W extends object>(
  wallet: W
): wallet is W & {
  simulateMultiTx: (msgs: { msg: unknown; msgTypeUrl: string }[], memo: string) => Promise<SkipTxResult>;
} {
  return typeof Reflect.get(wallet, "simulateMultiTx") === "function";
}

enum Messages {
  "/ibc.applications.transfer.v1.MsgTransfer" = "/ibc.applications.transfer.v1.MsgTransfer",
  "/cosmwasm.wasm.v1.MsgExecuteContract" = "/cosmwasm.wasm.v1.MsgExecuteContract",
  "/cosmos.bank.v1beta1.MsgSend" = "/cosmos.bank.v1beta1.MsgSend"
}

// The read* narrowers mirror cosmjs-types fromPartial defaults on absent fields
// ("" / 0n / []) so a valid Skip message builds the exact same tx as before, but
// a wrong-typed field throws instead of silently encoding a corrupt money message.
function readString(value: unknown, field: string): string {
  if (value == null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`Skip message field ${field} is not a string`);
  }
  return value;
}

function readTimestamp(value: unknown, field: string): bigint {
  if (value == null) {
    return BigInt(0);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return BigInt(value);
  }
  throw new Error(`Skip message field ${field} is not a timestamp`);
}

function readCoin(value: unknown, field: string): { denom: string; amount: string } | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object") {
    throw new Error(`Skip message field ${field} is not a coin`);
  }
  const denom = "denom" in value ? value.denom : undefined;
  const amount = "amount" in value ? value.amount : undefined;
  if ((denom !== undefined && typeof denom !== "string") || (amount !== undefined && typeof amount !== "string")) {
    throw new Error(`Skip message field ${field} is not a coin`);
  }
  return { denom: denom ?? "", amount: amount ?? "" };
}

function readCoinList(value: unknown, field: string): { denom: string; amount: string }[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Skip message field ${field} is not a coin list`);
  }
  const entries: unknown[] = value;
  return entries.map((entry, index) => {
    const coin = readCoin(entry, `${field}[${index}]`);
    if (coin === undefined) {
      throw new Error(`Skip message field ${field}[${index}] is not a coin`);
    }
    return coin;
  });
}

/**
 * Swap class - Routes all Skip API calls through the Rust backend
 */
class Swap {
  async getChains(): Promise<Chain[]> {
    const chains = await BackendApi.getSkipChains(true, true);
    assertChainList(chains);
    return chains;
  }

  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    const route = await BackendApi.getSkipRoute(request);
    assertRouteResponse(route);
    return route;
  }

  async getMessages(request: MessagesRequest): Promise<MessagesResponse> {
    const messages = await BackendApi.getSkipMessages(request);
    assertMessagesResponse(messages);
    return messages;
  }

  async getTransactionStatus({
    chain_id,
    tx_hash
  }: {
    chain_id: string;
    tx_hash: string;
  }): Promise<{ state: string; error: string }> {
    const status = await BackendApi.getSkipStatus(chain_id, tx_hash);
    return {
      state: status.state,
      error: status.error?.message ?? ""
    };
  }

  async getTransactionTrack({
    chain_id,
    tx_hash
  }: {
    chain_id: string;
    tx_hash: string;
  }): Promise<{ tx_hash: string; explorer_link: string }> {
    const response = await BackendApi.trackSkipTransaction(chain_id, tx_hash);
    return {
      tx_hash: response.tx_hash,
      explorer_link: response.explorer_link || ""
    };
  }
}

export class SkipRouter {
  private static client: Swap;
  private static chainId: string;
  private static chains: Promise<Chain[]> | undefined;

  static async getClient(): Promise<Swap> {
    if (SkipRouter.client) {
      return SkipRouter.client;
    }

    // Initialize client (no longer needs api_url - uses BackendApi)
    const [client, status] = await Promise.all([
      new Swap(),
      SkipRouter.chainId ?? fetchNetworkStatus().then((status) => status.result.node_info.network)
    ]);

    SkipRouter.chainId = status;
    SkipRouter.client = client;

    return SkipRouter.client;
  }

  static async getRoute(
    sourceDenom: string,
    destDenom: string,
    amount: string,
    revert: boolean = false,
    sourceId?: string,
    destSourceId?: string,
    network?: string
  ) {
    const client = await SkipRouter.getClient();
    const request: RouteRequest = {
      source_asset_denom: sourceDenom,
      source_asset_chain_id: sourceId ?? SkipRouter.chainId,
      dest_asset_denom: destDenom,
      dest_asset_chain_id: destSourceId ?? SkipRouter.chainId,
      ...(network !== undefined ? { network } : {})
    };
    if (revert) {
      request.amount_out = amount;
    } else {
      request.amount_in = amount;
    }

    const route = await client.getRoute(request);
    route.revert = true;
    return route;
  }

  static async submitRoute<W extends { address?: string | undefined }>(
    route: RouteResponse,
    wallets: { [key: string]: W },
    callback: (tx: SkipTxResult, wallet: W, chainId: string) => Promise<void>
  ) {
    return await SkipRouter.transaction(route, wallets, callback);
  }

  private static async transaction<W extends { address?: string | undefined }>(
    route: RouteResponse,
    wallets: { [key: string]: W },
    callback: (tx: SkipTxResult, wallet: W, chainId: string) => Promise<void>
  ) {
    const client = await SkipRouter.getClient();
    const addressList: string[] = [];
    const addresses: Record<string, string> = {};

    for (const [key, wallet] of Object.entries(wallets)) {
      const walletAddress = wallet.address;
      if (!walletAddress) {
        throw new Error(`Wallet address not available for ${key}`);
      }
      addresses[key] = walletAddress;
    }

    for (const id of route.chain_ids) {
      const address = addresses[id];
      if (address === undefined) {
        throw new Error(`Wallet address not available for ${id}`);
      }
      addressList.push(address);
    }

    const add: {
      amount_in: string;
      amount_out: string;
      source_asset_denom: string;
      dest_asset_denom: string;
    } = {
      amount_in: "",
      amount_out: "",
      source_asset_denom: "",
      dest_asset_denom: ""
    };

    if (route.revert) {
      add.amount_in = route.amount_in;
      add.amount_out = route.amount_out;
      add.source_asset_denom = route.source_asset_denom;
      add.dest_asset_denom = route.dest_asset_denom;
    } else {
      add.amount_in = route.amount_out;
      add.amount_out = route.amount_in;
      add.source_asset_denom = route.source_asset_denom;
      add.dest_asset_denom = route.dest_asset_denom;
    }

    const request: MessagesRequest = {
      source_asset_chain_id: route.source_asset_chain_id,
      dest_asset_chain_id: route.dest_asset_chain_id,
      operations: route.operations,
      address_list: addressList,
      ...add
    };

    const response = await client.getMessages(request);

    for (const tx of response?.txs ?? []) {
      const chainId = tx?.cosmos_tx?.chain_id;
      const wallet = wallets[chainId];
      if (wallet === undefined) {
        throw new Error(`Wallet not available for ${chainId}`);
      }
      if (!canSimulateMultiTx(wallet)) {
        throw new Error(`Wallet for ${chainId} cannot simulate transactions`);
      }

      const msgs = [];
      for (const m of tx.cosmos_tx.msgs) {
        const msgJSON = JSON.parse(m.msg);
        const message = SkipRouter.getTx(m, msgJSON);
        msgs.push({
          msg: message,
          msgTypeUrl: m.msg_type_url
        });
      }
      const txData = await wallet.simulateMultiTx(msgs, "");
      await callback(txData, wallet, chainId);
    }
  }

  static async fetchStatus(hash: string, chainId: string, retries = 60): Promise<SkipTransactionStatus> {
    const client = await SkipRouter.getClient();
    const status = await client.getTransactionStatus({ chain_id: chainId, tx_hash: hash });

    if (status.error) {
      throw new Error(status.error);
    }

    switch (status.state) {
      case "STATE_ABANDONED": {
        throw new Error(i18n.global.t("message.tx-state-abandoned"));
      }
      case "STATE_COMPLETED_SUCCESS": {
        return status;
      }
      case "STATE_COMPLETED_ERROR": {
        throw new Error(i18n.global.t("message.tx-state-error"));
      }
      case "STATE_PENDING_ERROR": {
        throw new Error(i18n.global.t("message.tx-state-pending-error"));
      }
    }

    if (retries <= 0) {
      throw new Error(i18n.global.t("message.tx-state-abandoned"));
    }

    await SkipRouter.wait(800);
    return SkipRouter.fetchStatus(hash, chainId, retries - 1);
  }

  private static wait(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }

  static getTx(msg: SkipMsg, msgJSON: Record<string, unknown>) {
    switch (msg.msg_type_url) {
      case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
        const token = readCoin(msgJSON.token, "token");
        const transfer = {
          sourcePort: readString(msgJSON.source_port, "source_port"),
          sourceChannel: readString(msgJSON.source_channel, "source_channel"),
          sender: readString(msgJSON.sender, "sender"),
          receiver: readString(msgJSON.receiver, "receiver"),
          timeoutTimestamp: readTimestamp(msgJSON.timeout_timestamp, "timeout_timestamp"),
          memo: readString(msgJSON.memo, "memo")
        };
        return token === undefined
          ? MsgTransfer.fromPartial(transfer)
          : MsgTransfer.fromPartial({ ...transfer, token });
      }
      case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
        return MsgSend.fromPartial({
          fromAddress: readString(msgJSON.from_address, "from_address"),
          toAddress: readString(msgJSON.to_address, "to_address"),
          amount: readCoinList(msgJSON.amount, "amount")
        });
      }
      case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
        // Skip API contract: msg is either a base64-encoded JSON blob (string) or a plain JSON object.
        // Any other type is a malformed response — refuse to construct a partial/empty tx (funds loss risk).
        const rawMsg = msgJSON.msg;
        let msgBytes: Uint8Array;
        if (typeof rawMsg === "string") {
          msgBytes = new Uint8Array(Buffer.from(rawMsg, "base64"));
        } else if (rawMsg && typeof rawMsg === "object") {
          msgBytes = new Uint8Array(Buffer.from(JSON.stringify(rawMsg), "utf-8"));
        } else {
          throw new Error(`MsgExecuteContract: unexpected msg type ${typeof rawMsg}`);
        }
        return MsgExecuteContract.fromPartial({
          sender: msgJSON.sender as string,
          contract: msgJSON.contract as string,
          msg: msgBytes,
          funds: (msgJSON.funds ?? []) as { denom: string; amount: string }[]
        });
      }
      default: {
        throw new Error(i18n.global.t("message.tx-action-not-supported"));
      }
    }
  }

  static async getChains() {
    if (SkipRouter.chains !== undefined) {
      return SkipRouter.chains;
    }
    const client = await SkipRouter.getClient();
    // Cache the in-flight promise to dedupe concurrent callers, but drop it on
    // rejection so a failed fetch doesn't poison the cache permanently — a
    // retry must be able to re-issue the request (see "Cache services" in the
    // project CLAUDE.md).
    SkipRouter.chains = client.getChains().catch((error: unknown) => {
      SkipRouter.chains = undefined;
      throw error;
    });
    return SkipRouter.chains;
  }

  static async track(chainId: string, hash: string, attempts = 0) {
    const client = await SkipRouter.getClient();
    try {
      await client.getTransactionTrack({
        chain_id: chainId,
        tx_hash: hash
      });
    } catch {
      if (attempts >= 5) {
        throw new Error(i18n.global.t("message.tx-tracking-failed"));
      }
      await SkipRouter.wait(4000);
      await SkipRouter.track(chainId, hash, attempts + 1);
    }
  }
}
