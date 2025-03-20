import { type Store } from "../types";
import { AppUtils, EnvNetworkUtils, WalletManager, WalletUtils } from "@/common/utils";
import { ChainConstants, NolusClient, NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { KeplrEmbedChainInfo } from "@/config/global/keplr";
import { Buffer } from "buffer";
import { Intercom } from "@/common/utils/Intercom";

export async function connectLeap(this: Store) {
  await WalletUtils.getLeap();
  const leapWindow = window as any;

  if (!leapWindow.leap.getOfflineSignerOnlyAmino || !leapWindow.leap) {
    throw new Error("Leap wallet is not installed.");
  } else if (!leapWindow.leap.experimentalSuggestChain) {
    throw new Error("Leap version is not latest. Please upgrade your Leap wallet");
  } else {
    let chainId = "";

    try {
      const networkConfig = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
      NolusClient.setInstance(networkConfig.rpc);

      chainId = await NolusClient.getInstance().getChainId();
      await leapWindow.leap?.experimentalSuggestChain(
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

    await leapWindow.leap?.enable(chainId);

    if (leapWindow.leap.getOfflineSignerOnlyAmino) {
      const offlineSigner = leapWindow.leap.getOfflineSignerOnlyAmino(chainId, {
        preferNoSetFee: true
      });
      const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(offlineSigner as any);
      await nolusWalletOfflineSigner.useAccount();

      WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.LEAP);
      WalletManager.setPubKey(Buffer.from((nolusWalletOfflineSigner?.pubKey ?? "") as string).toString("hex"));

      this.wallet = nolusWalletOfflineSigner;
      this.walletName = (await leapWindow.leap.getKey(chainId)).name;
      await this.UPDATE_BALANCES();
    }
  }

  this.loadActivities();
  Intercom.load(this.wallet?.address);
}
