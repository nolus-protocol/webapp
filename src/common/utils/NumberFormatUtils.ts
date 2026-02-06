/**
 * NumberFormatUtils - Number formatting utilities
 *
 * Handles number formatting for display in the UI.
 */

import { Dec } from "@keplr-wallet/unit";
import { DECIMALS_AMOUNT, MAX_DECIMALS, NATIVE_CURRENCY } from "@/config/global";

/**
 * Format a number with specified decimals and optional symbol
 */
export function formatNumber(amount: number | string, decimals: number, symbol?: string): string {
  const numValue = Number(amount);
  const sign = numValue < 0 ? "-" : "";

  const formatted = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  })
    .format(Math.abs(numValue))
    .toString();

  return `${sign}${symbol ?? ""}${formatted}`;
}

/**
 * Intl.NumberFormatOptions for standard currency display.
 * Use with AnimateNumber :format prop to keep animated and static formatting in sync.
 */
export function currencyFormatOptions(decimals: number): Intl.NumberFormatOptions {
  return { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
}

/**
 * Intl.NumberFormatOptions for compact currency display (K, M, B).
 * Use with AnimateNumber :format prop.
 */
export const compactFormatOptions: Intl.NumberFormatOptions = {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
};

/**
 * Format a Dec value as USD: "$1,234.56"
 * Replaces the common pattern: `${NATIVE_CURRENCY.symbol}${formatNumber(dec.toString(2), 2)}`
 */
export function formatDecAsUsd(amount: Dec): string {
  return formatNumber(
    amount.toString(NATIVE_CURRENCY.maximumFractionDigits),
    NATIVE_CURRENCY.maximumFractionDigits,
    NATIVE_CURRENCY.symbol
  );
}

/**
 * Format a number with compact notation (1K, 1M, etc.)
 */
export function formatCompact(amount: number | string, locale: string = NATIVE_CURRENCY.locale): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  }).format(Number(amount));
}

/**
 * Get adaptive decimal places based on amount size.
 * Larger amounts get fewer decimals, smaller amounts get more precision.
 * Thresholds: ≥10K→2, ≥1K→4, ≥100→6, <100→8
 */
export function getDecimals(amount: Dec): number {
  for (const item of DECIMALS_AMOUNT) {
    if (amount.gte(new Dec(item.amount))) {
      return item.decimals;
    }
  }
  return MAX_DECIMALS;
}

/**
 * Format a USD amount with 2 fixed decimals
 */
export function formatUsd(amount: number | string): string {
  return formatNumber(amount, 2, NATIVE_CURRENCY.symbol);
}

/**
 * Format a token balance with adaptive decimals based on amount size.
 * - Large amounts: fewer decimals (≥10K→2, ≥1K→4, ≥100→6)
 * - Small amounts (< 1): show up to the first significant digit + 1, min 2, max 8
 * - Trailing zeros are trimmed (min 2 decimals preserved)
 * - True zero: "0.00"
 */
export function formatTokenBalance(amount: Dec): string {
  const abs = amount.abs();

  if (abs.isZero()) {
    return formatNumber("0", 2);
  }

  // For amounts >= 1, use the threshold-based logic but trim trailing zeros
  if (abs.gte(new Dec(1))) {
    const maxDec = getDecimals(abs);
    const raw = amount.toString(maxDec);
    return formatNumberTrimmed(raw, 2, maxDec);
  }

  // For amounts < 1, find the first significant digit
  // e.g., 0.00045 → show 4 decimals (up to first sig digit + 1 extra)
  const str = abs.toString(MAX_DECIMALS);
  const afterDot = str.split(".")[1] ?? "";
  const firstSigIdx = afterDot.search(/[1-9]/);

  if (firstSigIdx === -1) {
    // All zeros after decimal point at 8 places — effectively zero
    return formatNumber("0", 2);
  }

  const decimals = Math.min(firstSigIdx + 2, MAX_DECIMALS);
  const raw = amount.toString(decimals);
  return formatNumberTrimmed(raw, 2, decimals);
}

/**
 * Format a number with locale grouping, trimming trailing zeros between min and max decimals.
 */
function formatNumberTrimmed(amount: string, minDecimals: number, maxDecimals: number): string {
  const numValue = Number(amount);
  const sign = numValue < 0 ? "-" : "";

  const formatted = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  }).format(Math.abs(numValue));

  return `${sign}${formatted}`;
}

/**
 * Format percentage value
 */
export function formatPercent(value: number | string, decimals: number = 2): string {
  const numValue = Number(value);
  return `${formatNumber(numValue, decimals)}%`;
}

/**
 * Parse a numeric string, handling locale-specific formatting
 */
export function parseNumericString(value: string): number {
  // Remove any non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned) || 0;
}
