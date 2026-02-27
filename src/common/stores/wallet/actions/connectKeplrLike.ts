import type { Keplr } from "@keplr-wallet/types";
import type { OfflineDirectSigner } from "@cosmjs/proto-signing";
import { type Store } from "../types";

import { EnvNetworkUtils, WalletManager } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { type WalletConnectMechanism } from "@/common/types";
import { KeplrEmbedChainInfo } from "@/config/global/keplr";
import { Buffer } from "buffer";
import { IntercomService } from "@/common/utils/IntercomService";
import { applyNolusWalletOverrides } from "@/networks/cosm/NolusWalletOverride";

export async function connectKeplrLike(
  store: Store,
  getExtension: () => Promise<Keplr | undefined>,
  mechanism: WalletConnectMechanism,
  label: string
) {
  const extension = await getExtension();

  if (!extension?.getOfflineSignerOnlyAmino || !extension) {
    throw new Error(`${label} wallet is not installed.`);
  } else if (!extension.experimentalSuggestChain) {
    throw new Error(`${label} version is not latest. Please upgrade your ${label} wallet`);
  } else {
    let chainId: string;

    try {
      const networkConfig = await fetchEndpoints(ChainConstants.CHAIN_KEY);
      NolusClient.setInstance(networkConfig.rpc);

      chainId = await NolusClient.getInstance().getChainId();
      await extension.experimentalSuggestChain(
        KeplrEmbedChainInfo(
          EnvNetworkUtils.getStoredNetworkName(),
          chainId,
          networkConfig.rpc as string,
          networkConfig.api as string
        )
      );
    } catch (e: unknown) {
      throw new Error(e instanceof Error ? e.message : String(e), { cause: e });
    }

    await extension.enable(chainId);

    if (extension.getOfflineSignerOnlyAmino) {
      const offlineSigner = extension.getOfflineSignerOnlyAmino(chainId, {
        preferNoSetFee: true
      });
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(
        offlineSigner as unknown as OfflineDirectSigner
      );
      await nolusWalletOfflineSigner.useAccount();

      store.wallet = nolusWalletOfflineSigner;
      applyNolusWalletOverrides(store.wallet);

      // Save mechanism only after wallet is fully set up
      WalletManager.saveWalletConnectMechanism(mechanism);
      WalletManager.setPubKey(Buffer.from((nolusWalletOfflineSigner?.pubKey ?? "") as string).toString("hex"));
    }
  }

  IntercomService.load(store.wallet?.address as string, label.toLowerCase());
}
