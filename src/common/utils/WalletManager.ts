import type { WalletConnectMechanism } from "@/common/types";

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

  public static storeWalletAddress(address: string) {
    localStorage.setItem(this.WALLET_ADDRESS, address);
  }

  public static getWalletAddress(): string {
    return "nolus128v75yfn7tesw26xauu70d8x9wv6fppt25qhxw";
    return localStorage.getItem(this.WALLET_ADDRESS) || "";
  }

  public static removeWalletAddress() {
    localStorage.removeItem(this.WALLET_ADDRESS);
  }

  public static eraseWalletInfo() {
    localStorage.removeItem(this.WALLET_ADDRESS);
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
    localStorage.removeItem(this.WALLET_PUBKEY);
  }
}
