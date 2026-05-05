import type { Keplr } from "@keplr-wallet/types";

import { KeyUtils } from "@nolus/nolusjs";
import { WalletManager } from ".";
import { Wallet, NETWORK_DATA } from "@/networks";
import { fetchEndpoints } from "./EndpointService";

function getKeplrExtension(): Promise<Keplr | undefined> {
  const w = window as unknown as { keplr?: Keplr };

  if (w.keplr) {
    return Promise.resolve(w.keplr);
  }

  if (document.readyState === "complete") {
    return Promise.resolve(w.keplr);
  }

  return new Promise((resolve) => {
    const documentStateChange = (event: Event) => {
      if (event.target && (event.target as Document).readyState === "complete") {
        resolve(w.keplr);
        document.removeEventListener("readystatechange", documentStateChange);
      }
    };

    document.addEventListener("readystatechange", documentStateChange);
  });
}

export class WalletUtils {
  public static getKeplr(): Promise<Keplr | undefined> {
    return getKeplrExtension();
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
