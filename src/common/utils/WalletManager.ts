import type { WalletConnectMechanism } from "@/common/types";
import { useWalletStore } from "../stores/wallet";
import { Contracts, DefaultProtocolFilter, isDev } from "@/config/global";

export class WalletManager {
  public static WALLET_CONNECT_MECHANISM = "wallet_connect_mechanism";
  public static WALLET_ADDRESS = "wallet_address";
  public static WALLET_PUBKEY = "wallet_pubkey";
  public static SHOW_SMALL_BALANCES = "show_small_balances";
  public static HIDE_BALANCES = "hide_balances";
  public static PROTOCOL_FILTER = "protocol_filter";

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

  public static setProtocolFilter(filter: string) {
    localStorage.setItem(this.PROTOCOL_FILTER, filter);
  }

  public static getProtocolFilter(): string {
    const filters = Object.keys(Contracts.protocolsFilter).map((item) => item);
    const item = localStorage.getItem(this.PROTOCOL_FILTER)!;
    if (filters.includes(item)) {
      return item;
    }
    return DefaultProtocolFilter;
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
      localStorage.setItem(WalletManager.HIDE_BALANCES, "0");
    } else {
      localStorage.setItem(WalletManager.HIDE_BALANCES, "1");
    }
  }

  public static getHideBalances() {
    const item = Number(localStorage.getItem(WalletManager.HIDE_BALANCES));
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
