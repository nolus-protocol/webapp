import {
  SkipClient as SkipRouterLib,
  SKIP_API_URL,
  type RouteRequest,
  affiliateFromJSON,
  type MsgsRequest,
  type TxStatusResponse,
  type Chain
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

class Swap extends SkipRouterLib {
  constructor(data: { apiURL: string; apiKey: string }) {
    super({ apiURL: data.apiURL });
  }
}

export class SkipRouter {
  private static client: Swap;
  private static chainID: string;
  private static chains: Promise<Chain[]>;

  static async getClient(): Promise<Swap> {
    if (SkipRouter.client) {
      return SkipRouter.client;
    }

    const config = await AppUtils.getSkipRouteConfig();
    const [client, status] = await Promise.all([
      new Swap({
        apiURL: SKIP_API_URL,
        apiKey: config.apiKey
      }),
      SkipRouter.chainID ?? AppUtils.fetchNetworkStatus().then((status) => status.result.node_info.network)
    ]);

    SkipRouter.chainID = status;
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
    const request: IObjectKeys = {
      sourceAssetDenom: sourceDenom,
      sourceAssetChainID: sourceId ?? SkipRouter.chainID,
      destAssetDenom: destDenom,
      destAssetChainID: destSourceId ?? SkipRouter.chainID,
      cumulativeAffiliateFeeBPS: config.fee.toString(),
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
    const route: IObjectKeys = await client.route(request as RouteRequest);
    route.revert = true;
    return route;
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

      for (const id of route.chainIDs) {
        addressList.push(addresses[id]);
      }
      const request: IObjectKeys = {
        sourceAssetChainID: route.sourceAssetChainID,
        destAssetChainID: route.destAssetChainID,
        swapVenue: route.swapVenue,
        timeoutSeconds: config.timeoutSeconds,
        operations: route.operations,
        slippageTolerancePercent: config.slippage.toString(),
        addressList: addressList,
        affiliates: SkipRouter.getAffialates(route, config)
      };

      if (route.revert) {
        request.amountIn = route.amountIn;
        request.amountOut = route.amountOut;
        request.sourceAssetDenom = route.sourceAssetDenom;
        request.destAssetDenom = route.destAssetDenom;
      } else {
        request.amountIn = route.amountOut;
        request.amountOut = route.amountIn;
        request.sourceAssetDenom = route.sourceAssetDenom;
        request.destAssetDenom = route.destAssetDenom;
      }
      const response = await client.messages(request as MsgsRequest);
      for (const tx of response.txs) {
        const chaindId = (tx as IObjectKeys)?.cosmosTx?.chainID ?? (tx as IObjectKeys)?.evmTx?.chainID;
        const wallet = wallets[(tx as IObjectKeys)?.cosmosTx?.chainID ?? (tx as IObjectKeys)?.evmTx?.chainID];

        switch (wallet.constructor) {
          case MetaMaskWallet: {
            const msg = (tx as IObjectKeys).evmTx;
            const signer = await wallet.getSigner();

            for (const t of msg.requiredERC20Approvals) {
              await (wallet as any).setApprove(t);
            }

            const txData = await (signer as IObjectKeys).sendTransaction({
              account: wallet.address,
              to: msg.to as string,
              data: `0x${msg.data}`,
              value: msg.value === "" ? undefined : BigInt(msg.value)
            });

            await callback(txData, wallet, chaindId);

            break;
          }
          default: {
            const msgs = [];
            for (const m of (tx as IObjectKeys).cosmosTx.msgs) {
              const msgJSON = JSON.parse(m.msg);
              const message = SkipRouter.getTx(m, msgJSON);
              msgs.push({
                msg: message,
                msgTypeUrl: m.msgTypeURL
              });
            }
            const txData = await (wallet as BaseWallet).simulateMultiTx(msgs as any, "");
            await callback(txData, wallet, chaindId);

            break;
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  static async fetchStatus(hash: string, chaindId: string): Promise<TxStatusResponse> {
    const client = await SkipRouter.getClient();
    const status = await client.transactionStatus({ chainID: chaindId, txHash: hash });

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
    return SkipRouter.fetchStatus(hash, chaindId);
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
      const affiliate = affiliateFromJSON({
        address: affiliateAddress,
        basis_points_fee: config.fee.toString()
      });
      return [affiliate];
    }

    return [];
  }

  static async track(chainId: string, hash: string) {
    try {
      const client = await SkipRouter.getClient();
      await client.trackTransaction({
        chainID: chainId,
        txHash: hash
      });
    } catch (error) {
      Logger.error(error);
    }
  }

  private static getTx(msg: IObjectKeys, msgJSON: IObjectKeys) {
    switch (msg.msgTypeURL) {
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
    SkipRouter.chains = client.chains({ includeEVM: true, includeSVM: false });
    return SkipRouter.chains;
  }
}
