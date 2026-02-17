import type { Keplr } from "@keplr-wallet/types";

import { KeyUtils } from "@nolus/nolusjs";
import { WalletManager } from ".";
import { Wallet, NETWORK_DATA } from "@/networks";
import { fetchEndpoints } from "./EndpointService";

function getExtension(prop: "keplr" | "leap"): Promise<Keplr | undefined> {
  const ext = (window as any)[prop];

  if (ext) {
    return Promise.resolve(ext);
  }

  if (document.readyState === "complete") {
    return Promise.resolve((window as any)[prop]);
  }

  return new Promise((resolve) => {
    const documentStateChange = (event: Event) => {
      if (event.target && (event.target as Document).readyState === "complete") {
        resolve((window as any)[prop]);
        document.removeEventListener("readystatechange", documentStateChange);
      }
    };

    document.addEventListener("readystatechange", documentStateChange);
  });
}

export class WalletUtils {
  public static getKeplr(): Promise<Keplr | undefined> {
    return getExtension("keplr");
  }

  public static getLeap(): Promise<Keplr | undefined> {
    return getExtension("leap");
  }

  public static isAuth(): boolean {
    return (
      KeyUtils.isAddressValid(WalletManager.getWalletAddress()) && WalletManager.getWalletConnectMechanism() !== null
    );
  }

  public static async getWallet(key: string): Promise<Wallet> {
    const network = NETWORK_DATA;
    const node = await fetchEndpoints(network.supportedNetworks[key].key);
    const client = await Wallet.getInstance(node.rpc, node.api);
    return client;
  }
}
