import { Decimal } from "../../oracle/decimal.js";

export interface ToleranceInput {
  actual: string;
  expected: string;
  tolerance: string;
}

export interface ToleranceResult {
  ok: boolean;
  actual: string;
  expected: string;
  deltaAbs: string;
  tolerance: string;
}

/**
 * Compare a rendered value against the oracle-computed expectation within an absolute tolerance,
 * all as truncating fixed-point decimals (never floats). `ok` is `|actual - expected| <= tolerance`.
 * This is the comparator the value-moving specs assert through and the one the negative-control
 * self-test drives to prove a wrong value is actually rejected.
 */
export function withinTolerance(input: ToleranceInput): ToleranceResult {
  const actual = Decimal.fromString(input.actual);
  const expected = Decimal.fromString(input.expected);
  const tolerance = Decimal.fromString(input.tolerance);
  if (tolerance.isNegative()) {
    throw new Error(`tolerance must be non-negative (got "${input.tolerance}")`);
  }
  const deltaAbs = actual.sub(expected).abs();
  return {
    ok: !deltaAbs.gt(tolerance),
    actual: input.actual,
    expected: input.expected,
    deltaAbs: deltaAbs.toString(8),
    tolerance: input.tolerance
  };
}

/**
 * Guard against a vacuous comparison. A tolerance assertion on a value whose oracle basis is
 * zero (NLS is priced at ~$0 on staging, so its USD figures are inert) proves nothing — any
 * wrong value would pass. Specs call this on the basis before asserting so a PnL/liquidation
 * tolerance is only ever taken on the non-zero-priced collateral leg.
 */
export function assertNonZeroBasis(input: { value: string; description: string }): void {
  if (Decimal.fromString(input.value).isZero()) {
    throw new Error(`tolerance basis "${input.description}" is zero — the assertion would be vacuous`);
  }
}

/** Throw a descriptive error when a value falls outside tolerance; used by the live specs. */
export function assertWithinTolerance(input: ToleranceInput, description: string): void {
  const result = withinTolerance(input);
  if (!result.ok) {
    throw new Error(
      `${description}: rendered ${result.actual} is outside tolerance ${result.tolerance} of expected ${result.expected} (|delta|=${result.deltaAbs})`
    );
  }
}
