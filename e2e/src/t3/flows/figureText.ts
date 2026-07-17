/** Normalize a rendered or oracle figure for comparison: drop whitespace, `$`, and thousands commas. */
export function normalizeFigure(value: string): string {
  return value.replace(/[\s$,]/g, "");
}

/** Whether two figures are equal once normalized (the AnimateNumber aria-label vs the oracle string). */
export function figuresEqual(a: string, b: string): boolean {
  return normalizeFigure(a) === normalizeFigure(b);
}
