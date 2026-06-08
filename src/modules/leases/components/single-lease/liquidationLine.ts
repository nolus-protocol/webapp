/**
 * Current liquidation-trigger price for the single-lease price chart.
 *
 * The chart draws a flat line at the position's *current* liquidation price —
 * the same value the position widgets show — instead of reconstructing a
 * per-event historical series. The backend exposes no liquidation-price
 * history, and the reconstruction this replaced added every history delta to
 * the debt side only, inflating the value far above spot (a Long BTC position
 * near $62k rendered a ~$109k trigger).
 *
 * Mirrors LeaseCalculator.calculateLiquidationPrice:
 *   Long:  (debt / collateral) / 0.9
 *   Short: (collateral * 0.9) / debt
 */
import { Dec } from "@keplr-wallet/unit";
import { LeaseMath } from "@/common/utils/LeaseMath";
import type { LeaseInfo } from "@/common/api";

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
