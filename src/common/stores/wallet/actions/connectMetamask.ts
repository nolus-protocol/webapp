import { type Store } from "../types";

import { WalletManager } from "@/common/utils";
import { NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { IntercomService } from "@/common/utils/IntercomService";
import { MetaMaskWallet } from "@/networks/evm";
import { MetamaskName } from "@/config/global";
import { useBalancesStore } from "../../balances";
import { useHistoryStore } from "../../history";

export async function connectMetamask(this: Store) {
  const metamask = new MetaMaskWallet();
  const { pubkeyAny } = await metamask.connect(WalletConnectMechanism.EVM_METAMASK);
  const signer = metamask.makeWCOfflineSigner();

  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();

  WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.EVM_METAMASK);
  WalletManager.setPubKey(Buffer.from(pubkeyAny).toString("hex"));

  this.wallet = nolusWalletOfflineSigner;
  this.walletName = MetamaskName;

  const balancesStore = useBalancesStore();
  await balancesStore.setAddress(this.wallet?.address ?? "");

  const historyStore = useHistoryStore();
  historyStore.setAddress(this.wallet?.address ?? "");
  historyStore.loadActivities();

  IntercomService.load(this.wallet.address, "metamask");
}
