import type { Window as KeplrWindow } from "@keplr-wallet/types/build/window";
import { type Store } from "../types";

import { EnvNetworkUtils, WalletManager, WalletUtils } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { KeplrEmbedChainInfo } from "@/config/global/keplr";
import { Buffer } from "buffer";
import { IntercomService } from "@/common/utils/IntercomService";
import { useBalancesStore } from "../../balances";
import { useHistoryStore } from "../../history";

export async function connectKeplr(this: Store) {
  await WalletUtils.getKeplr();
  const keplrWindow = window as KeplrWindow;

  if (!keplrWindow.getOfflineSignerOnlyAmino || !keplrWindow.keplr) {
    throw new Error("Keplr wallet is not installed.");
  } else if (!keplrWindow.keplr.experimentalSuggestChain) {
    throw new Error("Keplr version is not latest. Please upgrade your Keplr wallet");
  } else {
    let chainId = "";

    try {
      const networkConfig = await fetchEndpoints(ChainConstants.CHAIN_KEY);
      NolusClient.setInstance(networkConfig.rpc);

      chainId = await NolusClient.getInstance().getChainId();
      await keplrWindow.keplr?.experimentalSuggestChain(
        KeplrEmbedChainInfo(
          EnvNetworkUtils.getStoredNetworkName(),
          chainId,
          networkConfig.rpc as string,
          networkConfig.api as string
        )
      );
    } catch (e: Error | any) {
      throw new Error(e.message);
    }

    await keplrWindow.keplr?.enable(chainId);

    if (keplrWindow.getOfflineSignerOnlyAmino) {
      const offlineSigner = keplrWindow.getOfflineSignerOnlyAmino(chainId, {
        preferNoSetFee: true
      });
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner as any);
      await nolusWalletOfflineSigner.useAccount();

      WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.KEPLR);
      WalletManager.setPubKey(Buffer.from((nolusWalletOfflineSigner?.pubKey ?? "") as string).toString("hex"));

      this.wallet = nolusWalletOfflineSigner;
      this.walletName = (await keplrWindow.keplr.getKey(chainId)).name;
      
      const balancesStore = useBalancesStore();
      await balancesStore.setAddress(this.wallet?.address ?? "");
    }
  }

  const historyStore = useHistoryStore();
  historyStore.setAddress(this.wallet?.address ?? "");
  historyStore.loadActivities();
  IntercomService.load(this.wallet?.address as string, "keplr");
}
