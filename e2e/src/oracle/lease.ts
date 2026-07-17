/**
 * Lease-specific render rules, mirroring `leaseSize.ts` (list row) and
 * `usePositionSummary.ts` (detail widget) without importing them.
 *
 * The list row and the detail widget truncate at DIFFERENT times for the SHORT secondary
 * figure — the row divides then formats (continuous), the widget truncates the crypto to
 * an integer micro-amount FIRST and re-derives from that — so the two are modelled
 * separately. PnL and liquidation follow the documented store formulas.
 */

import { Decimal } from "./decimal.js";
import { formatDecAsUsd, formatTokenBalance, formatPrice } from "./format.js";

const ZERO = Decimal.zero();

export interface LeaseSizeInputs {
  positionType: "Long" | "Short";
  unitAsset: Decimal;
  assetValueUsd: Decimal;
  cryptoShortName?: string;
  cryptoPriceUsd?: Decimal;
}

export interface LeaseSizeCell {
  value: string;
  subValue: string;
}

/** `buildLeaseSizeCell`: LONG shows crypto primary / USD sub; SHORT shows USD / crypto sub. */
export function leaseSizeCell(inputs: LeaseSizeInputs): LeaseSizeCell {
  if (inputs.positionType !== "Short") {
    return {
      value: formatTokenBalance(inputs.unitAsset),
      subValue: formatDecAsUsd(inputs.assetValueUsd)
    };
  }
  const price = inputs.cryptoPriceUsd ?? ZERO;
  const cryptoAmount = price.isPositive() ? inputs.unitAsset.quo(price) : ZERO;
  const suffix = inputs.cryptoShortName ? ` ${inputs.cryptoShortName}` : "";
  return {
    value: formatDecAsUsd(inputs.assetValueUsd),
    subValue: `${formatTokenBalance(cryptoAmount)}${suffix}`
  };
}

/**
 * Detail-widget SHORT secondary (`usePositionSummary.sizeSecondary`): the crypto amount is
 * truncated to an integer micro-amount via `.truncate()` BEFORE display, unlike the list
 * row which formats the continuous quotient. Returns the integer micro-amount string.
 */
export function positionSecondaryShortMicro(stable: Decimal, price: Decimal, cryptoDecimals: number): string {
  if (price.isZero()) {
    return "0";
  }
  const crypto = stable.quo(price);
  const scaled = crypto.mul(Decimal.fromString((10 ** cryptoDecimals).toString()));
  // `.truncate()` -> integer part only (drop the fractional 18-dp tail).
  return scaled.toString(0);
}

export interface PnlInputs {
  assetValueUsd: Decimal;
  totalDebtUsd: Decimal;
  downpayment: Decimal;
  fee: Decimal;
  repayment: Decimal;
}

export interface PnlResult {
  amount: string;
  percent: string;
  pnlPositive: boolean;
}

/**
 * PnL: amount = assetValueUsd - totalDebtUsd - downpayment + fee - repayment;
 * percent = amount / (downpayment + repayment) * 100; positive when amount >= 0 (zero
 * counts positive). A zero denominator is the degenerate `{0, 0, true}` the app renders.
 */
export function computePnl(inputs: PnlInputs): PnlResult {
  const amount = inputs.assetValueUsd
    .sub(inputs.totalDebtUsd)
    .sub(inputs.downpayment)
    .add(inputs.fee)
    .sub(inputs.repayment);
  const denominator = inputs.downpayment.add(inputs.repayment);
  if (denominator.isZero()) {
    return { amount: "0.00", percent: "0.00", pnlPositive: true };
  }
  const percent = amount.quo(denominator).mul(Decimal.fromString("100"));
  return { amount: amount.toString(2), percent: percent.toString(2), pnlPositive: !amount.isNegative() };
}

export interface LiquidationInputs {
  serverPrice?: string | null;
  positionType: "Long" | "Short";
  debt: Decimal;
  collateral: Decimal;
}

const NINE_TENTHS = Decimal.fromString("0.9");

/**
 * Liquidation price: the server value is used as-is when present (already whole units,
 * never rescaled); otherwise Long = (debt / collateral) / 0.9, Short = (collateral * 0.9)
 * / debt. Rendered through `toString(8)` truncation then adaptive price decimals.
 */
export function computeLiquidation(inputs: LiquidationInputs): Decimal {
  if (inputs.serverPrice !== undefined && inputs.serverPrice !== null && inputs.serverPrice !== "") {
    return Decimal.fromString(inputs.serverPrice);
  }
  if (inputs.collateral.isZero() || inputs.debt.isZero()) {
    return ZERO;
  }
  if (inputs.positionType === "Long") {
    return inputs.debt.quo(inputs.collateral).quo(NINE_TENTHS);
  }
  return inputs.collateral.mul(NINE_TENTHS).quo(inputs.debt);
}

export function liquidationRendered(price: Decimal): string {
  return formatPrice(price.toString(8));
}
