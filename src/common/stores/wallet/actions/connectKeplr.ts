import type { Window as KeplrWindow } from "@keplr-wallet/types/build/window";
import { type Store } from "../types";

import { AppUtils, EnvNetworkUtils, WalletManager, WalletUtils } from "@/common/utils";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { KeplrEmbedChainInfo } from "@/config/global/keplr";
import { Buffer } from "buffer";
import { Intercom } from "@/common/utils/Intercom";

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
      const networkConfig = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
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
      const offlineSigner = keplrWindow.getOfflineSignerOnlyAmino(chainId);
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner as any);
      await nolusWalletOfflineSigner.useAccount();

      WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.KEPLR);
      WalletManager.setPubKey(Buffer.from(nolusWalletOfflineSigner?.pubKey ?? "").toString("hex"));

      this.wallet = nolusWalletOfflineSigner;
      this.walletName = (await keplrWindow.keplr.getKey(chainId)).name;

      await this.UPDATE_BALANCES();
    }
  }

  this.loadActivities();
  Intercom.load(this.wallet?.address);
}
