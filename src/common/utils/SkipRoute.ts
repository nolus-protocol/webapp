import {
  SkipRouter as SkipRouterLib,
  SKIP_API_URL,
  type RouteRequest,
  affiliateFromJSON,
  type MsgsRequest
} from "@skip-router/core";

import type { IObjectKeys } from "../types";

import { AppUtils, walletOperation } from ".";
import { useWalletStore } from "../stores/wallet";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { toUtf8 } from "@cosmjs/encoding";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";

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

  static async submitRoute(route: IObjectKeys, userAddresses: Record<string, string>) {
    return new Promise(async (resolve, reject) => {
      try {
        await walletOperation(async () => {
          try {
            await SkipRouter.transaction(route, userAddresses);
            resolve(true);
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private static async transaction(route: IObjectKeys, userAddresses: Record<string, string>) {
    try {
      const [client, config] = await Promise.all([SkipRouter.getClient(), AppUtils.getSkipRouteConfig()]);
      const affiliateAddress = config[route.swapVenue.name as keyof typeof config] as string;
      const affiliate = affiliateFromJSON({
        address: affiliateAddress,
        basis_points_fee: config.fee.toString()
      });
      const wallet = useWalletStore();
      const addressList = [];

      for (const id of route.chainIDs) {
        addressList.push(userAddresses[id]);
      }

      const request: IObjectKeys = {
        sourceAssetChainID: route.sourceAssetChainID,
        destAssetChainID: route.destAssetChainID,
        swapVenue: route.swapVenue,
        timeoutSeconds: config.timeoutSeconds,
        operations: route.operations,
        slippageTolerancePercent: config.slippage.toString(),
        addressList: addressList,
        affiliates: [affiliate]
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

      const msg = (response.txs[0] as IObjectKeys).cosmosTx.msgs[0];
      const msgJSON = JSON.parse(msg.msg);
      const message = SkipRouter.getTx(msg, msgJSON);

      const tx = await wallet.wallet.simulateTx(message, msg.msgTypeURL, "");
      const data = await wallet.wallet.broadcastTx(tx.txBytes as Uint8Array);
    } catch (error) {
      throw error;
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
      case Messages["/cosmwasm.wasm.v1.MsgExecuteContract"]: {
        return MsgExecuteContract.fromPartial({
          sender: msgJSON.sender,
          contract: msgJSON.contract,
          msg: toUtf8(JSON.stringify(msgJSON.msg)),
          funds: msgJSON.funds
        });
      }
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
