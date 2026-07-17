/**
 * The animated render paths (`AnimateNumber` `aria-label`). Distinct from the static
 * formatters because the aria-label carries the absolute value (sign and currency symbol
 * are separate DOM nodes), and two of the three paths round a second time.
 *
 *  - fixed:   FormattedAmount passes a pre-truncated value at fixed min = max decimals, so
 *             Intl is a rounding no-op — the shown digits are whatever was truncated in.
 *  - compact: the /stats-style headline (compact short) — rounds.
 *  - token:   TokenAmount truncates to the raw token decimals, THEN Intl re-rounds to the
 *             adaptive decimals when adaptive < raw — a genuine second rounding step.
 */

import type { Decimal } from "./decimal.js";
import { NATIVE_CURRENCY, formatCompact, getDecimals } from "./format.js";

function intl(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(NATIVE_CURRENCY.locale, { minimumFractionDigits, maximumFractionDigits });
}

/** FormattedAmount aria-label: absolute value at fixed decimals (Intl no-op on truncated input). */
export function animatedFixed(value: number | string, decimals: number): string {
  return intl(decimals, decimals).format(Math.abs(Number(value)));
}

/** Compact headline aria-label (the /stats figures): absolute value, compact short (rounds). */
export function animatedCompact(value: number | string): string {
  return formatCompact(Math.abs(Number(value)));
}

/**
 * TokenAmount aria-label: truncate to the raw token decimals, then re-round (min 2) to the
 * adaptive decimals. When adaptive < raw the second step rounds; otherwise it is a no-op.
 */
export function animatedToken(value: Decimal, rawDecimals: number): string {
  const truncated = value.toString(rawDecimals);
  const adaptiveMax = getDecimals(value.abs());
  return intl(2, adaptiveMax).format(Math.abs(Number(truncated)));
}
