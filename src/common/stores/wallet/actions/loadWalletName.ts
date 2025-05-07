import type { Store } from "../types";
import { WalletManager } from "@/common/utils";
import { WalletConnectMechanism } from "@/common/types";
import { LedgerName, WalletConnectName } from "@/config/global";

export async function loadWalletName(this: Store) {
  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.KEPLR: {
      break;
    }
    case WalletConnectMechanism.LEAP: {
      break;
    }
    case WalletConnectMechanism.WALLET_WC: {
      this.walletName = WalletConnectName;
      break;
    }
    case WalletConnectMechanism.LEDGER: {
      this.walletName = LedgerName;
      break;
    }
    case WalletConnectMechanism.LEDGER_BLUETOOTH: {
      this.walletName = LedgerName;
      break;
    }
  }

  return "wallet";
}
