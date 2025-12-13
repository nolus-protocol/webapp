import { type Store } from "../types";

import { WalletManager } from "@/common/utils";
import { NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { Intercom } from "@/common/utils/Intercom";
import { SolanaWallet } from "@/networks/sol";
import { SolflareName } from "@/config/global";

export async function connectSolflare(this: Store) {
  const sol = new SolanaWallet();
  const { pubkeyAny } = await sol.connect();
  const signer = sol.makeWCOfflineSigner();

  const nolusWalletOfflineSigner = await NolusWalletFactory.nolusOfflineSigner(signer);
  await nolusWalletOfflineSigner.useAccount();

  WalletManager.saveWalletConnectMechanism(WalletConnectMechanism.SOL_SOLFLARE);
  WalletManager.setPubKey(Buffer.from(pubkeyAny).toString("hex"));

  this.wallet = nolusWalletOfflineSigner;
  this.walletName = SolflareName;
  await this.UPDATE_BALANCES();
  this.loadActivities();
  Intercom.load(this.wallet.address);
}
