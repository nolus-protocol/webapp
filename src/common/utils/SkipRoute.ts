import type { IObjectKeys, SkipRouteConfigType } from "../types";
import type { Chain, RouteRequest, RouteResponse, MessagesRequest, MessagesResponse } from "../types/skipRoute";

import { AppUtils, Logger } from ".";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import type { BaseWallet } from "@/networks";
import { MetaMaskWallet } from "@/networks/metamask";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgDepositForBurnWithCaller } from "@/networks/list/noble/tx";

enum Messages {
  "/ibc.applications.transfer.v1.MsgTransfer" = "/ibc.applications.transfer.v1.MsgTransfer",
  "/cosmwasm.wasm.v1.MsgExecuteContract" = "/cosmwasm.wasm.v1.MsgExecuteContract",
  "/cosmos.bank.v1beta1.MsgSend" = "/cosmos.bank.v1beta1.MsgSend",
  "/circle.cctp.v1.MsgDepositForBurnWithCaller" = "/circle.cctp.v1.MsgDepositForBurnWithCaller"
}

class Swap {
  api_url: string;

  constructor(data: { api_url: string }) {
    this.api_url = data.api_url;
  }

  private async checkError(response: Response) {
    const items = await response.json();

    if (response.status != 200) {
      throw items;
    }

    return items;
  }

  async getChains(): Promise<Chain[]> {
    const data = await fetch(`${this.api_url}/info/chains?include_evm=true&include_svm=true`);
    const items = await this.checkError(data);
    return items.chains;
  }

  async getRoute(request: RouteRequest): Promise<RouteResponse> {
    const data = await fetch(`${this.api_url}/fungible/route`, {
      method: "POST",
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json"
      }
    });
    return this.checkError(data);
  }

  async getMessages(request: MessagesRequest): Promise<MessagesResponse> {
    const data = await fetch(`${this.api_url}/fungible/msgs`, {
      method: "POST",
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json"
      }
    });
    return this.checkError(data);
  }

  async getTransactionStatus({
    chain_id,
    tx_hash
  }: {
    chain_id: string;
    tx_hash: string;
  }): Promise<{ state: string; error: string }> {
    const data = await fetch(`${this.api_url}/tx/status?chain_id=${chain_id}&tx_hash=${tx_hash}`, {
      headers: {
        "Content-Type": "application/json"
      }
    });
    return this.checkError(data);
  }

  async getTransactionTrack({
    chain_id,
    tx_hash
  }: {
    chain_id: string;
    tx_hash: string;
  }): Promise<{ tx_hash: string; explorer_link: string }> {
    const data = await fetch(`${this.api_url}/register`, {
      method: "POST",
      body: JSON.stringify({
        chain_id,
        tx_hash
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });
    return this.checkError(data);
  }
}

export class SkipRouter {
  private static client: Swap;
  private static chainId: string;
  private static chains: Promise<Chain[]>;

  static async getClient(): Promise<Swap> {
    if (SkipRouter.client) {
      return SkipRouter.client;
    }

    const config = await AppUtils.getSkipRouteConfig();
    const [client, status] = await Promise.all([
      new Swap({
        api_url: config.api_url
      }),
      SkipRouter.chainId ?? AppUtils.fetchNetworkStatus().then((status) => status.result.node_info.network)
    ]);

    SkipRouter.chainId = status;
    SkipRouter.client = client as Swap;

    return SkipRouter.client;
  }

  static async getRoute(
    sourceDenom: string,
    destDenom: string,
    amount: string,
    revert: boolean = false,
    sourceId?: string,
    destSourceId?: string
  ) {
    const [client, config] = await Promise.all([SkipRouter.getClient(), AppUtils.getSkipRouteConfig()]);
    const request: RouteRequest = {
      source_asset_denom: sourceDenom,
      source_asset_chain_id: sourceId ?? SkipRouter.chainId,
      dest_asset_denom: destDenom,
      dest_asset_chain_id: destSourceId ?? SkipRouter.chainId,
      cumulative_affiliate_fee_bps: config.fee.toString(),
      go_fast: true,
      smart_relay: true,
      allow_multi_tx: true,
      allow_unsafe: true,
      swap_venues: config.swap_venues,
      experimental_features: ["stargate", "eureka", "hyperlane", "cctp"],
      smart_swap_options: {
        split_routes: true,
        evm_swaps: true
      }
    };
    if (revert) {
      request.amount_out = amount;
    } else {
      request.amount_in = amount;
    }

    const route = await client.getRoute(request as RouteRequest);
    route.revert = true;
    return route;
  }

  static async submitRoute(
    route: RouteResponse,
    wallets: { [key: string]: BaseWallet | MetaMaskWallet },
    callback: Function
  ) {
    try {
      return await SkipRouter.transaction(route, wallets, callback);
    } catch (error) {
      throw error;
    }
  }

  private static async transaction(
    route: RouteResponse,
    wallets: { [key: string]: BaseWallet | MetaMaskWallet },
    callback: Function
  ) {
    try {
      const [client, config] = await Promise.all([SkipRouter.getClient(), AppUtils.getSkipRouteConfig()]);
      const addressList = [];
      const addresses: Record<string, string> = {};

      for (const key in wallets) {
        addresses[key] = wallets[key].address!;
      }

      for (const id of route.chain_ids) {
        addressList.push(addresses[id]);
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
        chain_ids_to_affiliates: SkipRouter.getAffialates(route, config),
        timeout_seconds: config.timeoutSeconds,
        operations: route.operations,
        slippage_tolerance_percent: config.slippage.toString(),
        address_list: addressList,
        ...add
      };

      const response = await client.getMessages(request as MessagesRequest);

      for (const tx of response?.txs ?? []) {
        const chainId = tx?.cosmos_tx?.chain_id ?? tx?.evm_tx?.chain_id;
        const wallet = wallets[tx?.cosmos_tx?.chain_id ?? tx?.evm_tx?.chain_id];

        switch (wallet.constructor) {
          case MetaMaskWallet: {
            const msg = tx.evm_tx;
            const signer = await wallet.getSigner();
            for (const t of msg.required_erc20_approvals!) {
              await (wallet as any).setApprove(t);
            }

            const txData = await (signer as IObjectKeys).sendTransaction({
              account: wallet.address,
              to: msg.to as string,
              data: `0x${msg.data}`,
              value: msg.value === "" ? undefined : BigInt(msg.value!)
            });

            await callback(txData, wallet, chainId);

            break;
          }
          default: {
            const msgs = [];
            for (const m of tx.cosmos_tx.msgs) {
              const msgJSON = JSON.parse(m.msg);
              const message = SkipRouter.getTx(m, msgJSON);
              msgs.push({
                msg: message,
                msgTypeUrl: m.msg_type_url
              });
            }
            const txData = await (wallet as BaseWallet).simulateMultiTx(msgs as any, "");
            await callback(txData, wallet, chainId);

            break;
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  static async fetchStatus(hash: string, chainId: string): Promise<IObjectKeys> {
    const client = await SkipRouter.getClient();
    const status = await client.getTransactionStatus({ chain_id: chainId, tx_hash: hash });

    if (status.error) {
      throw status.error;
    }

    switch (status.state) {
      case "STATE_ABANDONED": {
        throw new Error("STATE_ABANDONED");
      }
      case "STATE_COMPLETED_SUCCESS": {
        return status;
      }
      case "STATE_COMPLETED_ERROR": {
        throw new Error("STATE_COMPLETED_ERROR");
      }
      case "STATE_PENDING_ERROR": {
        throw new Error("STATE_PENDING_ERROR");
      }
    }

    await SkipRouter.wait(800);
    return SkipRouter.fetchStatus(hash, chainId);
  }

  private static wait(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }

  private static getAffialates(route: IObjectKeys, config: SkipRouteConfigType) {
    if (route.swapVenue?.name) {
      const affiliateAddress = config[route.swapVenue.name as keyof typeof config] as string;
      const affiliates = {
        address: affiliateAddress,
        basisPointsFee: config.fee.toString()
      };
      return {
        [route.swapVenue.chainId as string]: { affiliates: [affiliates] }
      };
    }

    return {};
  }

  static async track(chainId: string, hash: string, attempts = 0) {
    try {
      const client = await SkipRouter.getClient();
      await client.getTransactionTrack({
        chain_id: chainId,
        tx_hash: hash
      });
    } catch (error) {
      await this.subTrack(chainId, hash, attempts);
    }
  }

  static async subTrack(chainId: string, hash: string, attempts = 0) {
    try {
      await SkipRouter.wait(4000);
      await this.track(chainId, hash, attempts);
    } catch (error) {}
  }

  private static getTx(msg: IObjectKeys, msgJSON: IObjectKeys) {
    switch (msg.msg_type_url) {
      case Messages["/ibc.applications.transfer.v1.MsgTransfer"]: {
        return MsgTransfer.fromPartial({
          sourcePort: msgJSON.source_port,
          sourceChannel: msgJSON.source_channel,
          sender: msgJSON.sender,
          receiver: msgJSON.receiver,
          token: msgJSON.token,
          timeoutHeight: undefined,
          timeoutTimestamp: msgJSON.timeout_timestamp,
          memo: msgJSON.memo
        });
      }
      case Messages["/cosmos.bank.v1beta1.MsgSend"]: {
        return MsgSend.fromPartial({
          fromAddress: msgJSON.from_address,
          toAddress: msgJSON.to_address,
          amount: msgJSON.amount
        });
      }
      case Messages["/circle.cctp.v1.MsgDepositForBurnWithCaller"]: {
        return MsgDepositForBurnWithCaller.fromPartial({
          amount: msgJSON.amount,
          burnToken: msgJSON.burn_token,
          destinationCaller: msgJSON.destination_caller,
          destinationDomain: msgJSON.destination_domain,
          from: msgJSON.from,
          mintRecipient: msgJSON.mint_recipient
        });
      }

      default: {
        throw new Error("Action not supported");
      }
    }
  }

  static async getChains() {
    if (SkipRouter.chains) {
      return SkipRouter.chains;
    }
    const client = await SkipRouter.getClient();
    SkipRouter.chains = client.getChains() as Promise<Chain[]>;
    return SkipRouter.chains;
  }
}
