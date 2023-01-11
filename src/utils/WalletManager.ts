import type { WalletConnectMechanism } from "@/types";

export class WalletManager {
  public static WALLET_SECURE_DATA = "wallet-secure-data";
  public static WALLET_SECURE_KEY = "wallet-secure-key";
  public static WALLET_CONNECT_MECHANISM = "wallet_connect_mechanism";
  public static WALLET_ADDRESS = "wallet_address";
  public static WALLET_NAME = "wallet_name";
  public static WALLET_PUBKEY = "wallet_pubkey";

  public static saveWalletConnectMechanism(
    walletConnectMechanism: WalletConnectMechanism
  ) {
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

  public static setWalletName(name: string) {
    localStorage.setItem(this.WALLET_NAME, name);
  }

  public static getWalletName(): string | null {
    return localStorage.getItem(this.WALLET_NAME);
  }

  public static removeWalletConnectMechanism() {
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
  }

  public static storeEncryptedPubKey(pubKey: string) {
    localStorage.setItem(this.WALLET_SECURE_KEY, pubKey);
  }

  public static getEncryptedPubKey(): string {
    const pubkey = localStorage.getItem(this.WALLET_SECURE_KEY);
    if (!pubkey) {
      throw new Error("Missing encrypted key");
    }
    return pubkey;
  }

  public static removeEncryptedPubKey() {
    localStorage.removeItem(this.WALLET_SECURE_KEY);
  }

  public static storeEncryptedPk(encryptedPk: string) {
    localStorage.setItem(this.WALLET_SECURE_DATA, encryptedPk);
  }

  public static getPrivateKey(): string {
    const pvKey = localStorage.getItem(this.WALLET_SECURE_DATA);
    if (!pvKey) {
      throw new Error("Missing encrypted private key");
    }
    return pvKey;
  }

  public static removePrivateKey() {
    localStorage.removeItem(this.WALLET_SECURE_DATA);
  }

  public static storeWalletAddress(address: string) {
    localStorage.setItem(this.WALLET_ADDRESS, address);
  }

  public static getWalletAddress(): string {
    return localStorage.getItem(this.WALLET_ADDRESS) || "";
  }

  public static removeWalletAddress() {
    localStorage.removeItem(this.WALLET_ADDRESS);
  }

  public static eraseWalletInfo() {
    localStorage.removeItem(this.WALLET_ADDRESS);
    localStorage.removeItem(this.WALLET_SECURE_DATA);
    localStorage.removeItem(this.WALLET_SECURE_KEY);
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM);
    localStorage.removeItem(this.WALLET_NAME);
    localStorage.removeItem(this.WALLET_PUBKEY);
  }
}
