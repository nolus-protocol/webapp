/** Normalize a rendered or oracle figure for comparison: drop whitespace, `$`, and thousands commas. */
export function normalizeFigure(value: string): string {
  return value.replace(/[\s$,]/g, "");
}

/**
 * Whether a normalized aria-label matches a normalized oracle figure. Exact equality, or the
 * aria-label carries the same numeric value with a trailing unit ticker (e.g. "500.001NLS") —
 * the boundary between the digits and the unit must not split a number.
 */
export function matchesFigure(aria: string, want: string): boolean {
  if (aria === want) return true;
  return aria.startsWith(want) && /^[A-Za-z_]/.test(aria.slice(want.length));
}
