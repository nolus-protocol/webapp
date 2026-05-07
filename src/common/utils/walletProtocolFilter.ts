import { useConfigStore } from "@/common/stores/config";
import { WalletConnectMechanism } from "@/common/types";

/**
 * Map a wallet-connect mechanism to the network the wallet owns.
 *
 * Keplr (and Keplr-likes routed through `connectKeplrLike`) own OSMOSIS;
 * Phantom (EVM bridge) and Solflare both own SOLANA. Ledger / Ledger BLE
 * are sunset and intentionally unwired — callers must NOT call
 * `applyWalletProtocolFilter` on a Ledger connect path; this function
 * still returns `undefined` for them so the wrapper degrades to "" cleanly.
 *
 * NOTE: when adding a new producible network here, also add it to the
 * `WALLET_PRODUCIBLE_NETWORKS` allowlist in `src/common/stores/config/index.ts`
 * — the config-store watcher uses that set to decide whether a filter value
 * is worth a fetch attempt (vs. rejecting it as gibberish).
 */
export function protocolFilterForMechanism(mechanism: WalletConnectMechanism | null | undefined): string | undefined {
  switch (mechanism) {
    case WalletConnectMechanism.KEPLR:
      return "OSMOSIS";
    case WalletConnectMechanism.EVM_PHANTOM:
    case WalletConnectMechanism.SOL_SOLFLARE:
      return "SOLANA";
    default:
      return undefined;
  }
}

/**
 * Push the wallet's owned network into the config store as the active
 * protocol filter. Pass `null` / `undefined` (e.g. on disconnect) to clear
 * the filter back to "" so the next connect's first watcher tick sees a
 * fresh slate.
 */
export function applyWalletProtocolFilter(mechanism: WalletConnectMechanism | null | undefined): void {
  useConfigStore().setProtocolFilter(protocolFilterForMechanism(mechanism) ?? "");
}
