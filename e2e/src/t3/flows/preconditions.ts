import { Decimal } from "../../oracle/decimal.js";
import { readString } from "../../t2/matrixHelpers.js";

/**
 * Cosmos caps concurrent unbonding entries per delegator/validator pair at 7; a run that would
 * add the 8th is a precondition to fix (rotate validator or wait), never an app red.
 */
export const UNBONDING_ENTRY_CAP = 7;

export interface UnbondingGate {
  ok: boolean;
  entries: number;
  cap: number;
}

/** True while the target validator has room for one more unbonding entry. */
export function unbondingEntryGate(entries: number, cap: number = UNBONDING_ENTRY_CAP): UnbondingGate {
  return { ok: entries < cap, entries, cap };
}

export interface ValidatorEntryCount {
  validatorAddress: string;
  entries: number;
}

/**
 * Pick a target validator that still has unbonding-entry headroom, rotating away from any that
 * is at or near the cap. Returns the address of the first candidate under the cap, or undefined
 * when every candidate is saturated (the spec then precondition-skips).
 */
export function pickUnbondingValidator(
  candidates: ValidatorEntryCount[],
  cap: number = UNBONDING_ENTRY_CAP
): string | undefined {
  for (const candidate of candidates) {
    if (unbondingEntryGate(candidate.entries, cap).ok) {
      return candidate.validatorAddress;
    }
  }
  return undefined;
}

/**
 * Whether a Skip quote payload carries a usable route for the requested amount. A dust amount
 * routinely has no route on staging, which is a precondition skip rather than a failure — so the
 * spec pre-probes the quote and only executes when this returns true. Accepts the amount-out
 * either at the top level or under a `route`/`quote` wrapper and requires it to be positive.
 */
export function hasSwapRoute(payload: unknown): boolean {
  const amountOut =
    readString(payload, "amount_out") ??
    readString(payload, "route", "amount_out") ??
    readString(payload, "quote", "amount_out");
  if (amountOut === undefined || !/^\d+$/.test(amountOut)) {
    return false;
  }
  return BigInt(amountOut) > 0n;
}

// Skip returns a routing failure as a non-2xx (a 502 has been observed) whose body carries a
// `SWAP_ROUTE_FAILED` code / "no routes found" message. That is semantically a NO-ROUTE (a
// precondition to skip), not a network/API error — so the route probe must reclassify it rather
// than report an environment flake. Matched defensively against the sanitized error text.
const NO_ROUTE_MARKERS = [/SWAP_ROUTE_FAILED/i, /no\s+routes?\s+found/i, /no\s+route/i];

/** Whether a failed route probe's (sanitized) error text signals a genuine no-route, not an API/network error. */
export function isNoRouteFailure(message: string): boolean {
  return NO_ROUTE_MARKERS.some((marker) => marker.test(message));
}

/** The POST body of a `/api/swap/route` routability probe (backend `RouteRequest`). */
export interface SwapRouteRequest {
  source_asset_denom: string;
  source_asset_chain_id: string;
  dest_asset_denom: string;
  dest_asset_chain_id: string;
  amount_in: string;
}

/**
 * Build the swap-route probe body. `/api/swap/route` is a POST endpoint (a GET 405s); the app's
 * own `SkipRouter.getRoute` defaults both chain ids to the connected Nolus chain for a same-chain
 * quote, so a routability probe mirrors that — both ids are the Nolus chain id, and the dust amount
 * is the forward `amount_in`. Source and dest must be resolved bank denoms, never tickers.
 */
export function buildSwapRouteRequest(args: {
  sourceDenom: string;
  destDenom: string;
  amountMicro: string;
  chainId: string;
}): SwapRouteRequest {
  return {
    source_asset_denom: args.sourceDenom,
    source_asset_chain_id: args.chainId,
    dest_asset_denom: args.destDenom,
    dest_asset_chain_id: args.chainId,
    amount_in: args.amountMicro
  };
}

interface DownpaymentRange {
  currency: string;
  min: Decimal;
}

function extractRanges(payload: unknown): DownpaymentRange[] {
  const root =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>).downpayment_ranges
      : undefined;
  const ranges: DownpaymentRange[] = [];
  if (Array.isArray(root)) {
    for (const entry of root) {
      const currency = readString(entry, "ticker") ?? readString(entry, "currency");
      const min = readString(entry, "min");
      if (currency !== undefined && min !== undefined) {
        ranges.push({ currency, min: Decimal.fromString(min) });
      }
    }
  } else if (typeof root === "object" && root !== null) {
    for (const [currency, value] of Object.entries(root as Record<string, unknown>)) {
      const min = readString(value, "min");
      if (min !== undefined) {
        ranges.push({ currency, min: Decimal.fromString(min) });
      }
    }
  }
  return ranges;
}

/**
 * Resolve the minimum USD-equivalent downpayment required to open a lease from the live
 * `/api/leases/config/<protocol>` payload. Returns the range floor for `currency` when present,
 * else the highest floor across all currencies (the safe amount that clears any range). Throws
 * when no ranges parse so a drifted config shape is a red rather than a silent zero minimum.
 */
export function resolveDownpaymentFloorUsd(payload: unknown, currency?: string): Decimal {
  const ranges = extractRanges(payload);
  if (ranges.length === 0) {
    throw new Error("no downpayment ranges found in the lease config");
  }
  if (currency !== undefined) {
    const match = ranges.find((range) => range.currency === currency);
    if (match !== undefined) {
      return match.min;
    }
  }
  return ranges.reduce((max, range) => (range.min.gt(max) ? range.min : max), Decimal.zero());
}

/** Parse a lease config's downpayment ranges into `{ currency, minUsd }` pairs (empty when none). */
export function parseDownpaymentRanges(config: unknown): { currency: string; minUsd: Decimal }[] {
  return extractRanges(config).map((range) => ({ currency: range.currency, minUsd: range.min }));
}

/** True when a partial repay/close leaves at least the protocol's `min_asset` residual. */
export function remainsAboveMin(remainingMicro: bigint, minMicro: bigint): boolean {
  return remainingMicro >= minMicro;
}
