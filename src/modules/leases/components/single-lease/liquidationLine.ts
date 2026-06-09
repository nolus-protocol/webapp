/**
 * Liquidation-trigger data for the single-lease price chart.
 *
 * Two surfaces:
 *  - `computeChartLiquidationPrice` — the position's *current* trigger as a
 *    single number, drawn as a flat line. Used as the fallback when no
 *    per-event history is available (short positions, missing-registry data,
 *    or ETL not yet exposing the series).
 *  - `buildLiquidationSteps` / `liquidationAt` — the *historical stepped* line,
 *    built from ETL's per-event reconstructed `liquidation_price` (whole units).
 *    The reconstruction lives server-side (extract-transform-load#71); never
 *    reconstruct it client-side from deltas — the prior client-side attempt
 *    added every history delta to the debt side only, inflating a Long BTC
 *    trigger near $62k to ~$109k (#193).
 *
 * Mirrors LeaseCalculator.calculateLiquidationPrice:
 *   Long:  (debt / collateral) / 0.9
 *   Short: (collateral * 0.9) / debt
 */
import { Dec } from "@keplr-wallet/unit";
import { LeaseMath } from "@/common/utils/LeaseMath";
import type { LeaseHistoryEntry, LeaseInfo } from "@/common/api";

export interface LiquidationPriceInputs {
  /** `Long` / `Short` — raw value from `configStore.getPositionType`. */
  positionType: "Long" | "Short" | string;
  /** Collateral decimals — `lease.amount.ticker`'s currency decimals. */
  unitDecimals: number;
  /** Debt-principal decimals — the protocol LPN's currency decimals. */
  stableDecimals: number;
}

/**
 * Returns the liquidation price as a plain number, or `0` when it cannot be
 * computed (not an opened lease, or missing/zero collateral or debt). The
 * caller renders no liquidation line for a `0`.
 */
export function computeChartLiquidationPrice(
  lease: LeaseInfo | null | undefined,
  inputs: LiquidationPriceInputs
): number {
  if (!lease || lease.status !== "opened") {
    return 0;
  }

  if (lease.liquidation_price) {
    return Number(lease.liquidation_price);
  }

  const unitAsset = new Dec(lease.amount.amount, inputs.unitDecimals);
  const stableAsset = new Dec(lease.debt.principal, inputs.stableDecimals);
  if (!unitAsset.isPositive() || !stableAsset.isPositive()) {
    return 0;
  }

  const liquidation =
    inputs.positionType === "Short"
      ? LeaseMath.calculateLiquidationShort(unitAsset, stableAsset)
      : LeaseMath.calculateLiquidation(stableAsset, unitAsset);

  return Number(liquidation.toString());
}

export interface LiquidationStep {
  /** Event time as epoch milliseconds. */
  time: number;
  /** Whole-unit trigger price, strictly positive. */
  price: number;
}

/**
 * Build the stepped liquidation-trigger series from a lease's ETL history.
 *
 * Each entry's `liquidation_price` is ETL's per-event reconstructed trigger in
 * whole units — used as-is, never re-scaled by currency decimals. Events with
 * no active trigger are dropped: `null`/missing (short positions, missing
 * registry inputs) and `"0"` (a fully-repaid event) — see #236. The result is
 * sorted ascending by time; an empty result signals the caller to fall back to
 * the flat current-value line.
 */
export function buildLiquidationSteps(history: readonly LeaseHistoryEntry[] | null | undefined): LiquidationStep[] {
  if (!history) {
    return [];
  }

  return history
    .map((entry) => ({
      time: entry.timestamp == null ? NaN : new Date(entry.timestamp).getTime(),
      price: entry.liquidation_price == null ? NaN : Number(entry.liquidation_price)
    }))
    .filter((step) => Number.isFinite(step.time) && Number.isFinite(step.price) && step.price > 0)
    .sort((a, b) => a.time - b.time);
}

/**
 * The liquidation trigger effective at `timeMs`, given `steps` ascending by
 * time: the most-recent step at or before `timeMs`. Returns `null` when
 * `timeMs` precedes the first step (no trigger established yet). Past the last
 * step, an `active` (opened) position extends its current trigger to `timeMs`,
 * while a closed/repaid position returns `null` so its line ends at the last
 * positive value rather than extending across the post-close region (#236).
 */
export function liquidationAt(steps: readonly LiquidationStep[], timeMs: number, active: boolean): number | null {
  let current: number | null = null;
  let lastTime = Number.NEGATIVE_INFINITY;
  for (const step of steps) {
    if (timeMs < step.time) {
      return current;
    }
    current = step.price;
    lastTime = step.time;
  }

  if (current === null) {
    return null;
  }
  // Strictly past the last event: only an open position carries its trigger
  // forward to `timeMs`; a closed/repaid position ends at its last value (#236).
  return timeMs > lastTime && !active ? null : current;
}

/**
 * The trigger value to plot at a single chart point, as a string label or
 * `null` (a gap). When a per-event series exists (`steps` non-empty) the
 * stepped value at `timeMs` is used; otherwise the flat current value `flat`
 * (`<= 0` means no flat line). `active` is whether the position is still opened.
 * This is the step-vs-flat selection the chart applies to every price point.
 */
export function liquidationLabelFor(
  steps: readonly LiquidationStep[],
  flat: number,
  timeMs: number,
  active: boolean
): string | null {
  const value = steps.length > 0 ? liquidationAt(steps, timeMs, active) : flat > 0 ? flat : null;
  return value === null ? null : value.toString();
}
