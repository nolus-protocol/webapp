import type { CapDenom } from "../spendCap.js";
import { NATIVE_DENOM } from "../../transfer.js";

// Single source of truth for the denom strings the flow specs and cap-seeding share, so the two
// can never drift. The cap denoms ("nls"/"usdc") are what the journal's `charged` field carries;
// USDC_DENOM is the display chain denom the specs record in `denoms`.

export const USDC_DENOM = "ibc/usdc";
export const CAP_DENOM_NLS = "nls";
export const CAP_DENOM_USDC = "usdc";

/**
 * Map a denom string to its cap denom by EXACT match (never substring) — accepts both the cap
 * denoms as journaled in `charged` and the native/USDC chain denoms; anything else is uncapped.
 */
export function capDenomOf(denom: string): CapDenom | undefined {
  if (denom === CAP_DENOM_NLS || denom === NATIVE_DENOM) {
    return "nls";
  }
  if (denom === CAP_DENOM_USDC || denom === USDC_DENOM) {
    return "usdc";
  }
  return undefined;
}
