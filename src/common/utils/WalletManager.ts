import type { WalletConnectMechanism } from "@/common/types";
import { useWalletStore } from "../stores/wallet";
import { isDev } from "@/config/global";

export class WalletManager {
  public static WALLET_CONNECT_MECHANISM = "wallet_connect_mechanism";
  public static WALLET_ADDRESS = "wallet_address";
  public static WALLET_PUBKEY = "wallet_pubkey";

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

  public static eraseWalletInfo() {
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
    localStorage.removeItem(this.WALLET_PUBKEY);
  }
}
