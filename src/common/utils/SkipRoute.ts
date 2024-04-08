import { SkipRouter as SkipRouterLib, SKIP_API_URL, type RouteRequest, type RouteResponse } from "@skip-router/core";
import { AppUtils, walletOperation } from ".";
import { useWalletStore } from "../stores/wallet";
import type { IObjectKeys } from "../types";
import type { OfflineSigner } from "@cosmjs/proto-signing";
import { SLIPPAGE } from "@/config/global/swap";

class Swap extends SkipRouterLib {
  signer: OfflineSigner | null;
  constructor(data: {
    apiURL: string;
    signer: OfflineSigner;
    getCosmosSigner: (chainID: string) => Promise<OfflineSigner>;
  }) {
    super(data);
    this.signer = data.signer;
  }
}

export class SkipRouter {
  private static client: Swap;
  private static chainID: string;

  static async getClient(): Promise<Swap> {
    const wallet = useWalletStore();
    const signer = wallet.wallet?.getOfflineSigner();

    if (SkipRouter.client && SkipRouter.client.signer && signer != SkipRouter.client.signer) {
      return SkipRouter.client;
    }

    const [client, status] = await Promise.all([
      new Promise((resolve) => {
        walletOperation(async () => {
          const signer = wallet.wallet?.getOfflineSigner();
          const client = new Swap({
            apiURL: SKIP_API_URL,
            signer,
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
    SkipRouter.client = client as Swap;

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
    return new Promise(async (resolve, reject) => {
      try {
        await client.executeRoute({
          route,
          userAddresses,
          slippageTolerancePercent: SLIPPAGE.toString(),
          onTransactionCompleted: async (tx) => {
            resolve(tx);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static async getChains() {
    const client = await SkipRouter.getClient();
    return client.chains({ includeEVM: false, includeSVM: false, includeTestnets: false });
  }
}
