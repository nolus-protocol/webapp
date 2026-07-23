import { useConfigStore } from "@/common/stores/config";
import { ChainType } from "@/common/types/Network";

/**
 * Which router services a network's swaps.
 * `skip` = Cosmos networks via the Skip API (OSMOSIS, unchanged);
 * `solana` = the Solana router.
 */
export type SwapProviderId = "skip" | "solana";

/**
 * Seam over the swap pipeline. Call sites dispatch on `id` to select the
 * concrete router for the session's active network.
 */
export interface SwapProvider {
  readonly id: SwapProviderId;
}

/** Raised when a network's `chain_type` maps to no swap provider. */
export class UnknownSwapNetworkError extends Error {
  constructor(protocolFilter: string) {
    super(`No swap provider is registered for network "${protocolFilter}"`);
    this.name = "UnknownSwapNetworkError";
  }
}

const SKIP_PROVIDER: SwapProvider = { id: "skip" };
const SOLANA_PROVIDER: SwapProvider = { id: "solana" };

/**
 * Resolve the swap provider for a `protocolFilter` (an uppercase network key)
 * by the network's `chain_type`: cosmos -> Skip, svm -> Solana. An unknown or
 * unconfigured network throws {@link UnknownSwapNetworkError} — never a silent
 * Skip fallback.
 */
export function getSwapProvider(protocolFilter: string): SwapProvider {
  const chainType = useConfigStore().getNetwork(protocolFilter)?.chain_type;
  switch (chainType) {
    case ChainType.cosmos:
      return SKIP_PROVIDER;
    case ChainType.svm:
      return SOLANA_PROVIDER;
    default:
      throw new UnknownSwapNetworkError(protocolFilter);
  }
}
