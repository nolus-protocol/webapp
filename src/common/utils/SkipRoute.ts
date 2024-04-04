import { SkipRouter as SkipRouterLib, SKIP_API_URL, type RouteRequest, type RouteResponse } from "@skip-router/core";
import { AppUtils, walletOperation } from ".";
import { useWalletStore } from "../stores/wallet";
import type { IObjectKeys } from "../types";

export class SkipRouter {
  private static client: SkipRouterLib;
  private static chainID: string;

  static async getClient(): Promise<SkipRouterLib> {
    if (SkipRouter.client) {
      return SkipRouter.client;
    }

    const [client, status] = await Promise.all([
      new Promise((resolve) => {
        walletOperation(async () => {
          const wallet = useWalletStore();
          const signer = wallet.wallet?.getOfflineSigner();
          console.log(signer);
          const client = new SkipRouterLib({
            apiURL: SKIP_API_URL,
            getCosmosSigner: async (chainID) => {
              return signer;
            }
          });

          return resolve(client);
        });
      }),
      SkipRouter.chainID ?? AppUtils.fetchNetworkStatus().then((status) => status.result.node_info.network)
    ]);

    SkipRouter.chainID = status;
    SkipRouter.client = client as SkipRouterLib;

    return SkipRouter.client;
  }

  static async getRoute(sourceDenom: string, destDenom: string, amount: string, revert: boolean = false) {
    const client = await SkipRouter.getClient();

    const request: IObjectKeys = {
      sourceAssetDenom: sourceDenom,
      sourceAssetChainID: SkipRouter.chainID,
      destAssetDenom: destDenom,
      destAssetChainID: SkipRouter.chainID,
      allowMultiTx: true,
      allowUnsafe: true,
      experimentalFeatures: ["cctp", "hyperlane"],
      rapidRelay: true
    };

    if (revert) {
      request.amountOut = amount;
    } else {
      request.amountIn = amount;
    }

    return client.route(request as RouteRequest);

    // const gasCalc = 200000n;
    // const gas = await client.getRecommendedGasPrice("pirin-1");
    // const pow = 10n ** BigInt(gas?.amount.fractionalDigits ?? 1);
    // const gasPrice = (BigInt(gas?.amount?.atomics ?? 0n) * gasCalc) / pow;
    // console.log(gasPrice, pow);

    // await client.executeRoute({
    //   route,
    //   userAddresses: USER_ADDRESSES,
    //   onTransactionCompleted: async (tx) => {
    //     console.log(tx);
    //   }
    // });
  }

  static async submitRoute(route: RouteResponse, userAddresses: Record<string, string>) {
    const client = await SkipRouter.getClient();
    client.executeRoute({
      route,
      userAddresses,
      onTransactionCompleted: async (tx) => {
        console.log(tx);
      }
    });
  }
}
