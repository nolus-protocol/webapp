import {
  SkipRouter as SkipRouterLib,
  SKIP_API_URL,
  type RouteRequest,
  affiliateFromJSON,
  type MsgsRequest
} from "@skip-router/core";

import type { IObjectKeys, SkipRouteConfigType } from "../types";

import { AppUtils } from ".";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import type { BaseWallet } from "@/networks";

enum Messages {
  "/ibc.applications.transfer.v1.MsgTransfer" = "/ibc.applications.transfer.v1.MsgTransfer",
  "/cosmwasm.wasm.v1.MsgExecuteContract" = "/cosmwasm.wasm.v1.MsgExecuteContract"
}

class Swap extends SkipRouterLib {
  constructor(data: { apiURL: string }) {
    super(data);
  }
}

export class SkipRouter {
  private static client: Swap;
  private static chainID: string;

  static async getClient(): Promise<Swap> {
    if (SkipRouter.client) {
      return SkipRouter.client;
    }

    const [client, status] = await Promise.all([
      new Swap({
        apiURL: SKIP_API_URL
      }),
      SkipRouter.chainID ?? AppUtils.fetchNetworkStatus().then((status) => status.result.node_info.network)
    ]);

    SkipRouter.chainID = status;
    SkipRouter.client = client as Swap;

    return SkipRouter.client;
  }

  static async getRoute(sourceDenom: string, destDenom: string, amount: string, revert: boolean = false) {
    const [client, config] = await Promise.all([SkipRouter.getClient(), AppUtils.getSkipRouteConfig()]);
    console.log(amount);
    const request: IObjectKeys = {
      sourceAssetDenom: sourceDenom,
      sourceAssetChainID: SkipRouter.chainID,
      destAssetDenom: destDenom,
      destAssetChainID: SkipRouter.chainID,
      allowMultiTx: false,
      cumulativeAffiliateFeeBPS: config.fee.toString()
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

  static async submitRoute(route: IObjectKeys, wallets: { [key: string]: BaseWallet }, callback: Function) {
    try {
      return await SkipRouter.transaction(route, wallets, callback);
    } catch (error) {
      throw error;
    }
  }

  private static async transaction(route: IObjectKeys, wallets: { [key: string]: BaseWallet }, callback: Function) {
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
        const msg = (tx as IObjectKeys).cosmosTx.msgs[0];
        const msgJSON = JSON.parse(msg.msg);
        const message = SkipRouter.getTx(msg, msgJSON);
        const wallet = wallets[(tx as IObjectKeys).cosmosTx.chainID];

        const txData = await (wallet as IObjectKeys).simulateTx(message, msg.msgTypeURL, "");
        await callback(txData, wallet);
      }
    } catch (error) {
      throw error;
    }
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
      //TODO: not use for now update if require
      // case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
      //   return MsgExecuteContract.fromPartial({
      //     sender: msgJSON.sender,
      //     contract: msgJSON.contract,
      //     msg: toUtf8(JSON.stringify(msgJSON.msg)),
      //     funds: msgJSON.funds
      //   });
      // }
      default: {
        throw new Error("Action not supported");
      }
    }
  }

  static async getChains() {
    const client = await SkipRouter.getClient();
    return client.chains({ includeEVM: false, includeSVM: false, includeTestnets: false });
  }
}
