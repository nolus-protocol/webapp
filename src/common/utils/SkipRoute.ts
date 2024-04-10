import {
  SkipRouter as SkipRouterLib,
  SKIP_API_URL,
  type RouteRequest,
  affiliateFromJSON,
  type MsgsDirectRequest
} from "@skip-router/core";
import { AppUtils, walletOperation } from ".";
import { useWalletStore } from "../stores/wallet";
import type { IObjectKeys, SkipRouteConfigType } from "../types";
import type { OfflineSigner } from "@cosmjs/proto-signing";

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
    const [client, config] = await Promise.all([SkipRouter.getClient(), AppUtils.getSkipRouteConfig()]);
    return new Promise(async (resolve, reject) => {
      try {
        const affiliateAddress = config[route.swapVenue.name as keyof typeof config] as string;
        const affiliate = affiliateFromJSON({
          address: affiliateAddress,
          basis_points_fee: config.fee.toString()
        });

        const request: IObjectKeys = {
          sourceAssetDenom: route.sourceAssetDenom,
          sourceAssetChainID: route.sourceAssetChainID,
          destAssetDenom: route.destAssetDenom,
          destAssetChainID: route.destAssetChainID,
          swapVenue: route.swapVenue,
          timeoutSeconds: config.timeoutSeconds,
          slippageTolerancePercent: config.slippage.toString(),
          chainIdsToAddresses: userAddresses,
          affiliates: [affiliate]
        };

        if (route.revert) {
          request.amountOut = route.amountOut;
        } else {
          request.amountIn = route.amountIn;
        }

        const response = await client.msgsDirect(request as MsgsDirectRequest);

        await client.executeRoute({
          route: response.route,
          userAddresses,
          gasAmountMultiplier: config.gas_multiplier,
          slippageTolerancePercent: config.slippage.toString(),
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
