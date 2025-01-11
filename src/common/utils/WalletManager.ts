import type { WalletConnectMechanism } from "@/common/types";
import { useWalletStore } from "../stores/wallet";
import { isDev } from "@/config/global";

export class WalletManager {
  public static WALLET_CONNECT_MECHANISM = "wallet_connect_mechanism";
  public static WALLET_ADDRESS = "wallet_address";
  public static WALLET_PUBKEY = "wallet_pubkey";
  public static SHOW_SMALL_BALANCES = "show_small_balances";
  public static HIDE_BALANCES = "hide_balances";

  public static saveWalletConnectMechanism(walletConnectMechanism: WalletConnectMechanism) {
    localStorage.setItem(this.WALLET_CONNECT_MECHANISM, walletConnectMechanism);
  }

  public static getWalletConnectMechanism(): string | null {
    return localStorage.getItem(this.WALLET_CONNECT_MECHANISM);
  }

  public static setPubKey(pubkey: string) {
    localStorage.setItem(this.WALLET_PUBKEY, pubkey);
  }

  public static getPubKey(): string | null {
    return localStorage.getItem(this.WALLET_PUBKEY);
  }

  public static removeWalletConnectMechanism() {
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
  }

  public static getWalletAddress(): string {
    const wallet = useWalletStore();

    let address = wallet.wallet?.address ?? "";
    const searchParamAddress = new URLSearchParams(window.location.search).get("address");

    if (isDev() && searchParamAddress) {
      address = searchParamAddress;
    }

    return address;
  }

  public static setSmallBalances(bool: boolean) {
    if (!bool) {
      localStorage.setItem(WalletManager.SHOW_SMALL_BALANCES, "false");
    } else {
      localStorage.removeItem(WalletManager.SHOW_SMALL_BALANCES);
    }
  }

  public static getSmallBalances() {
    return !localStorage.getItem(WalletManager.SHOW_SMALL_BALANCES);
  }

  public static setHideBalances(bool: boolean) {
    if (!bool) {
      localStorage.setItem(WalletManager.HIDE_BALANCES, "false");
    } else {
      localStorage.removeItem(WalletManager.HIDE_BALANCES);
    }
  }

  public static getHideBalances() {
    return !localStorage.getItem(WalletManager.HIDE_BALANCES);
  }

  public static eraseWalletInfo() {
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
    localStorage.removeItem(this.WALLET_PUBKEY);
  }
}
