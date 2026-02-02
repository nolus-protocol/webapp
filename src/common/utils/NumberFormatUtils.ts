/**
 * NumberFormatUtils - Number formatting utilities
 *
 * Handles number formatting for display in the UI.
 */

import { Dec } from "@keplr-wallet/unit";
import { DECIMALS_AMOUNT, NATIVE_CURRENCY } from "@/config/global";

/**
 * Format a number with specified decimals and optional symbol
 */
export function formatNumber(
  amount: number | string,
  decimals: number,
  symbol?: string
): string {
  const numValue = Number(amount);
  const sign = numValue < 0 ? "-" : "";

  const formatted = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  })
    .format(Math.abs(numValue))
    .toString();

  return `${sign}${symbol ?? ""}${formatted}`;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number | string,
  currency: string = "USD",
  locale: string = NATIVE_CURRENCY.locale
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(Number(amount));
}

/**
 * Format a number with compact notation (1K, 1M, etc.)
 */
export function formatCompact(
  amount: number | string,
  locale: string = NATIVE_CURRENCY.locale
): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
  }).format(Number(amount));
}

/**
 * Get appropriate decimal places based on amount value
 * Returns -1 if no matching threshold found
 */
export function getDecimals(amount: Dec): number {
  for (const item of DECIMALS_AMOUNT) {
    if (amount.gte(new Dec(item.amount))) {
      return item.decimals;
    }
  }
  return -1;
}

/**
 * Format percentage value
 */
export function formatPercent(
  value: number | string,
  decimals: number = 2
): string {
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


