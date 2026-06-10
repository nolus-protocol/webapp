import { WalletConnectMechanism } from "@/common/types";
import { useWalletStore } from "../stores/wallet";

export class WalletStorage {
  public static WALLET_CONNECT_MECHANISM = "wallet_connect_mechanism";
  public static WALLET_ADDRESS = "wallet_address";
  public static WALLET_PUBKEY = "wallet_pubkey";
  public static SHOW_SMALL_BALANCES = "show_small_balances";
  public static HIDE_BALANCES = "hide_balances";

  public static saveWalletConnectMechanism(walletConnectMechanism: WalletConnectMechanism) {
    localStorage.setItem(this.WALLET_CONNECT_MECHANISM, walletConnectMechanism);
  }

  /**
   * Returns the persisted wallet-connect mechanism, or `null` if absent or stale.
   *
   * Side effect: if the stored value is not a current `WalletConnectMechanism`
   * enum member (e.g. left over from a removed wallet integration), this call
   * clears `WALLET_CONNECT_MECHANISM` and `WALLET_PUBKEY` from localStorage and
   * returns `null`. Without this, an unknown value falls through to undefined
   * map lookups in `walletOperation` / `externalWallet` and crashes the
   * auto-reconnect path.
   */
  public static getWalletConnectMechanism(): WalletConnectMechanism | null {
    const stored = localStorage.getItem(this.WALLET_CONNECT_MECHANISM);
    if (stored === null) return null;
    const match = Object.values(WalletConnectMechanism).find((mechanism) => mechanism === stored);
    if (match === undefined) {
      this.eraseWalletInfo();
      return null;
    }
    return match;
  }

  public static setPubKey(pubkey: string) {
    localStorage.setItem(this.WALLET_PUBKEY, pubkey);
  }

  public static getWalletAddress(): string {
    const wallet = useWalletStore();
    return wallet.wallet?.address ?? "";
  }

  public static setSmallBalances(bool: boolean) {
    if (!bool) {
      localStorage.setItem(WalletStorage.SHOW_SMALL_BALANCES, "false");
    } else {
      localStorage.removeItem(WalletStorage.SHOW_SMALL_BALANCES);
    }
  }

  public static getSmallBalances() {
    return !localStorage.getItem(WalletStorage.SHOW_SMALL_BALANCES);
  }

  public static setHideBalances(bool: boolean) {
    if (!bool) {
      localStorage.setItem(WalletStorage.HIDE_BALANCES, "0");
    } else {
      localStorage.setItem(WalletStorage.HIDE_BALANCES, "1");
    }
  }

  public static getHideBalances() {
    const item = Number(localStorage.getItem(WalletStorage.HIDE_BALANCES));
    if (item) {
      return true;
    }
    return false;
  }

  public static eraseWalletInfo() {
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
    localStorage.removeItem(this.WALLET_PUBKEY);
  }
}
