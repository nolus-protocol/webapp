/**
 * The display half of the render oracle: a byte-for-byte reimplementation of the app's
 * `src/common/utils/NumberFormatUtils.ts`, importing nothing from the app. `Intl` is the
 * platform (the app uses it too), so the rounding it performs is reproduced by using the
 * same options; every truncation the app does with keplr `Dec` is reproduced with the
 * independent `Decimal`. Where the app rounds vs. truncates is preserved exactly — that
 * split is the subtlest part of the money surface.
 */

import { Decimal } from "./decimal.js";

export const NATIVE_CURRENCY = { symbol: "$", locale: "en-US", minimumFractionDigits: 2, maximumFractionDigits: 2 };
export const MAX_DECIMALS = 8;
const DECIMALS_AMOUNT: readonly { decimals: number; amount: number }[] = [
  { decimals: 2, amount: 10000 },
  { decimals: 4, amount: 1000 },
  { decimals: 6, amount: 100 }
];

function intl(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(NATIVE_CURRENCY.locale, { minimumFractionDigits, maximumFractionDigits });
}

/** Mirror of `formatNumber`: fixed `decimals`, Intl-rounded, sign + optional symbol. */
export function formatNumber(amount: number | string, decimals: number, symbol?: string): string {
  const numValue = Number(amount);
  const prefix = symbol ?? "";
  if (Number.isNaN(numValue)) {
    return `${prefix}0.${"0".repeat(Math.max(decimals, 0))}`;
  }
  const sign = numValue < 0 ? "-" : "";
  const formatted = intl(decimals, decimals).format(Math.abs(numValue));
  return `${sign}${prefix}${formatted}`;
}

/** Mirror of `formatNumberTrimmed`: trailing zeros trimmed between min and max decimals. */
function formatNumberTrimmed(amount: string, minDecimals: number, maxDecimals: number): string {
  const numValue = Number(amount);
  const sign = numValue < 0 ? "-" : "";
  return `${sign}${intl(minDecimals, maxDecimals).format(Math.abs(numValue))}`;
}

export const compactFormatOptions: Intl.NumberFormatOptions = {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
};

export function formatCompact(amount: number | string): string {
  return new Intl.NumberFormat(NATIVE_CURRENCY.locale, compactFormatOptions).format(Number(amount));
}

/** `formatDecAsUsd`: truncate to 2 dp, then `$`-prefix (the truncating USD path). */
export function formatDecAsUsd(amount: Decimal): string {
  return formatNumber(amount.toString(2), 2, NATIVE_CURRENCY.symbol);
}

/** `formatUsd`: 2 dp, Intl-rounded (the rounding USD path — distinct from formatDecAsUsd). */
export function formatUsd(amount: number | string): string {
  return formatNumber(amount, 2, NATIVE_CURRENCY.symbol);
}

export function formatPercent(amount: number | string, decimals = 2): string {
  return `${formatNumber(amount, decimals)}%`;
}

export function getDecimals(amount: Decimal): number {
  for (const item of DECIMALS_AMOUNT) {
    if (amount.gte(Decimal.fromString(item.amount.toString()))) {
      return item.decimals;
    }
  }
  return MAX_DECIMALS;
}

function firstSignificantDecimals(absStr: string): number {
  const afterDot = absStr.split(".")[1] ?? "";
  const firstSigIdx = afterDot.search(/[1-9]/);
  if (firstSigIdx === -1) {
    return -1;
  }
  return Math.min(firstSigIdx + 2, MAX_DECIMALS);
}

/** `formatTokenBalance`: adaptive decimals, trimmed, truncating (min 2, zero -> "0.00"). */
export function formatTokenBalance(amount: Decimal): string {
  const abs = amount.abs();
  if (abs.isZero()) {
    return formatNumber("0", 2);
  }
  if (abs.gte(Decimal.fromString("1"))) {
    const maxDec = getDecimals(abs);
    return formatNumberTrimmed(amount.toString(maxDec), 2, maxDec);
  }
  const decimals = firstSignificantDecimals(abs.toString(MAX_DECIMALS));
  if (decimals === -1) {
    return formatNumber("0", 2);
  }
  return formatNumberTrimmed(amount.toString(decimals), 2, decimals);
}

export function getAdaptivePriceDecimals(amount: number): number {
  const abs = Math.abs(amount);
  if (abs === 0) return 2;
  if (abs >= 10000) return 2;
  if (abs >= 1) return 4;
  const afterDot = abs.toFixed(MAX_DECIMALS).split(".")[1] ?? "";
  const firstSigIdx = afterDot.search(/[1-9]/);
  if (firstSigIdx === -1) return 2;
  return Math.min(firstSigIdx + 2, MAX_DECIMALS);
}

/** `formatPrice`: adaptive decimals, Intl-rounded via `toFixed` (the one rounding path). */
export function formatPrice(amount: number | string): string {
  const num = Number(amount);
  if (num === 0 || Number.isNaN(num)) {
    return formatNumber("0", 2);
  }
  const maxDec = getAdaptivePriceDecimals(num);
  return formatNumberTrimmed(num.toFixed(maxDec), 2, maxDec);
}

export function formatPriceUsd(amount: number | string): string {
  const num = Number(amount);
  const sign = num < 0 ? "-" : "";
  return `${sign}${NATIVE_CURRENCY.symbol}${formatPrice(Math.abs(num))}`;
}

export function formatMobileAmount(amount: Decimal): string {
  if (amount.abs().gte(Decimal.fromString("1000"))) {
    return formatCompact(amount.toString());
  }
  return formatTokenBalance(amount);
}

export function formatMobileUsd(amount: Decimal): string {
  if (amount.abs().gte(Decimal.fromString("1000"))) {
    return `${NATIVE_CURRENCY.symbol}${formatCompact(amount.toString(2))}`;
  }
  return formatUsd(amount.toString(2));
}
