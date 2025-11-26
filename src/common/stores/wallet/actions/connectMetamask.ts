import { type Store } from "../types";

import { WalletManager } from "@/common/utils";
import { NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { Intercom } from "@/common/utils/Intercom";
import { MetaMaskWallet } from "@/networks/evm";
import { MetamaskName } from "@/config/global";

export async function connectMetamask(this: Store) {
  const metamask = new MetaMaskWallet();
  const { pubkeyAny } = await metamask.connect();
  const signer = metamask.makeWCOfflineSigner();

  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();

  WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.EVM_METAMASK);
  WalletManager.setPubKey(Buffer.from(pubkeyAny).toString("hex"));

  this.wallet = nolusWalletOfflineSigner;
  this.walletName = MetamaskName;
  await this.UPDATE_BALANCES();
  this.loadActivities();
  Intercom.load(this.wallet.address);
}
