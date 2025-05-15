import {
  chains as getChains,
  route,
  messages,
  transactionStatus,
  trackTransaction,
  type RouteRequest,
  type MessagesRequest,
  type TxStatusResponse,
  type Chain,
  setClientOptions
} from "@skip-go/client";

import type { IObjectKeys, SkipRouteConfigType } from "../types";

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
  getChains = getChains;
  route = route;

  data: { apiKey: string };
  messages = messages;
  transactionStatus = transactionStatus;
  trackTransaction = trackTransaction;
  constructor(data: { apiKey: string }) {
    setClientOptions({});
    this.data = data;
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
        apiKey: config.apiKey
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
      sourceAssetDenom: sourceDenom,
      sourceAssetChainId: sourceId ?? SkipRouter.chainId,
      destAssetDenom: destDenom,
      destAssetChainId: destSourceId ?? SkipRouter.chainId,
      cumulativeAffiliateFeeBps: config.fee.toString(),
      goFast: true,
      smartRelay: true,
      allowMultiTx: true,
      allowUnsafe: true,
      swapVenues: config.swapVenues,
      experimentalFeatures: ["stargate", "eureka", "hyperlane", "cctp"],
      smartSwapOptions: {
        splitRoutes: true,
        evmSwaps: true
      }
    };
    if (revert) {
      request.amountOut = amount;
    } else {
      request.amountIn = amount;
    }

    const route = await client.route(request as RouteRequest);
    (route as IObjectKeys).revert = true;
    return route as IObjectKeys;
  }

  static async submitRoute(
    route: IObjectKeys,
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
    route: IObjectKeys,
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

      for (const id of route.chainIds) {
        addressList.push(addresses[id]);
      }

      const add: {
        amountIn: string;
        amountOut: string;
        sourceAssetDenom: string;
        destAssetDenom: string;
      } = {
        amountIn: "",
        amountOut: "",
        sourceAssetDenom: "",
        destAssetDenom: ""
      };

      if (route.revert) {
        add.amountIn = route.amountIn;
        add.amountOut = route.amountOut;
        add.sourceAssetDenom = route.sourceAssetDenom;
        add.destAssetDenom = route.destAssetDenom;
      } else {
        add.amountIn = route.amountOut;
        add.amountOut = route.amountIn;
        add.sourceAssetDenom = route.sourceAssetDenom;
        add.destAssetDenom = route.destAssetDenom;
      }

      const request: MessagesRequest = {
        sourceAssetChainId: route.sourceAssetChainId,
        destAssetChainId: route.destAssetChainId,
        chainIdsToAffiliates: SkipRouter.getAffialates(route, config),
        timeoutSeconds: config.timeoutSeconds,
        operations: route.operations,
        slippageTolerancePercent: config.slippage.toString(),
        addressList: addressList,
        ...add
      };

      const response = await client.messages(request as MessagesRequest);
      for (const tx of response?.txs ?? []) {
        const chainId = (tx as IObjectKeys)?.cosmosTx?.chainId ?? (tx as IObjectKeys)?.evmTx?.chainId;
        const wallet = wallets[(tx as IObjectKeys)?.cosmosTx?.chainId ?? (tx as IObjectKeys)?.evmTx?.chainId];

        switch (wallet.constructor) {
          case MetaMaskWallet: {
            const msg = (tx as IObjectKeys).evmTx;
            const signer = await wallet.getSigner();
            for (const t of msg.requiredErc20Approvals) {
              await (wallet as any).setApprove(t);
            }

            const txData = await (signer as IObjectKeys).sendTransaction({
              account: wallet.address,
              to: msg.to as string,
              data: `0x${msg.data}`,
              value: msg.value === "" ? undefined : BigInt(msg.value)
            });

            await callback(txData, wallet, chainId);

            break;
          }
          default: {
            const msgs = [];
            for (const m of (tx as IObjectKeys).cosmosTx.msgs) {
              const msgJSON = JSON.parse(m.msg);
              const message = SkipRouter.getTx(m, msgJSON);
              msgs.push({
                msg: message,
                msgTypeUrl: m.msgTypeUrl
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

  static async fetchStatus(hash: string, chainId: string): Promise<TxStatusResponse> {
    const client = await SkipRouter.getClient();
    const status = await client.transactionStatus({ chainId, txHash: hash });

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

  static async track(chainId: string, hash: string) {
    try {
      const client = await SkipRouter.getClient();
      await client.trackTransaction({
        chainId,
        txHash: hash
      });
    } catch (error) {
      Logger.error(error);
    }
  }

  private static getTx(msg: IObjectKeys, msgJSON: IObjectKeys) {
    switch (msg.msgTypeUrl) {
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
    SkipRouter.chains = client.getChains({ includeEvm: true, includeSvm: false }) as Promise<Chain[]>;
    return SkipRouter.chains;
  }
}
