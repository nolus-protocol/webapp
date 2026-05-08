import type { Keplr } from "@keplr-wallet/types";

import { KeyUtils } from "@nolus/nolusjs";
import { WalletManager } from ".";
import { Wallet, NETWORK_DATA } from "@/networks";
import { fetchEndpoints } from "./EndpointService";

// Defense against extensions that inject a `window.keplr` shim without identifying as
// Keplr. Real Keplr always sets `isKeplr === true`. Strict-equality guard mirrors the
// `isPhantom`/`isSolflare` checks in `src/networks/sol/wallet.ts` (PR #155).
function isRealKeplr(k?: Keplr): k is Keplr {
  return (k as unknown as { isKeplr?: unknown })?.isKeplr === true;
}

function getKeplrExtension(): Promise<Keplr | undefined> {
  const w = window as unknown as { keplr?: Keplr };

  if (isRealKeplr(w.keplr)) {
    return Promise.resolve(w.keplr);
  }

  if (document.readyState === "complete") {
    return Promise.resolve(isRealKeplr(w.keplr) ? w.keplr : undefined);
  }

  return new Promise((resolve) => {
    const documentStateChange = (event: Event) => {
      if (event.target && (event.target as Document).readyState === "complete") {
        resolve(isRealKeplr(w.keplr) ? w.keplr : undefined);
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
