import type { Keplr } from "@keplr-wallet/types";

import { KeyUtils } from "@nolus/nolusjs";
import { WalletStorage } from ".";
import { Wallet } from "@/networks";
import { getNetworkData } from "@/networks/config";
import { fetchEndpoints } from "./EndpointService";

// Note: unlike Phantom/Solflare, Keplr does NOT expose an `isKeplr === true` marker
// on its Cosmos provider (`window.keplr`). The `isKeplr` flag in `@keplr-wallet/types`
// is on the EthereumProvider type — Keplr's EVM bridge — not on the main Keplr
// interface. A strict-equality marker check rejects real Keplr; do not re-add one
// without a verified, Cosmos-side identity signal. See `runbooks/webapp_wallet_network.md`.
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

export class WalletAccess {
  public static getKeplr(): Promise<Keplr | undefined> {
    return getKeplrExtension();
  }

  public static isAuth(): boolean {
    return (
      KeyUtils.isAddressValid(WalletStorage.getWalletAddress()) && WalletStorage.getWalletConnectMechanism() !== null
    );
  }

  public static async getWallet(key: string): Promise<Wallet> {
    const network = getNetworkData();
    const supportedNetwork = network.supportedNetworks[key];
    if (supportedNetwork === undefined) {
      throw new Error(`Unsupported network: ${key}`);
    }
    const node = await fetchEndpoints(supportedNetwork.key);
    const client = await Wallet.getInstance(node.rpc, node.api);
    return client;
  }
}
