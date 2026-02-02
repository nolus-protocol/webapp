import { type Store } from "../types";

import { WalletManager } from "@/common/utils";
import { NolusWalletFactory } from "@nolus/nolusjs";
import { WalletConnectMechanism } from "@/common/types";
import { Buffer } from "buffer";
import { IntercomService } from "@/common/utils/IntercomService";
import { SolanaWallet } from "@/networks/sol";
import { SolflareName } from "@/config/global";
import { useBalancesStore } from "../../balances";
import { useHistoryStore } from "../../history";

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

  const balancesStore = useBalancesStore();
  await balancesStore.setAddress(this.wallet?.address ?? "");

  const historyStore = useHistoryStore();
  historyStore.setAddress(this.wallet?.address ?? "");
  historyStore.loadActivities();

  IntercomService.load(this.wallet.address, "solflare");
}
