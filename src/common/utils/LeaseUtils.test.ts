import { describe, it, expect } from "vitest";
import { Dec } from "@keplr-wallet/unit";
import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import { LeaseUtils } from "./LeaseUtils";

// Helper: Dec equality via string with fixed precision.
// Dec.equals is strict on internal precision; comparing toString at a known precision is reliable.
function decEquals(a: Dec, b: Dec, precision = 18): boolean {
  return a.toString(precision) === b.toString(precision);
}

describe("LeaseUtils.calculateLiquidation", () => {
  it("should compute unit / price / 0.9", () => {
    // 1000 / 10 / 0.9 = 111.111...
    const result = LeaseUtils.calculateLiquidation(new Dec(1000), new Dec(10));
    // Dec(0.9) from number has full 18-decimal precision; exact expected is 1000/10 = 100; 100/0.9 ≈ 111.111...
    expect(result.toString(4)).toBe("111.1111");
    expect(result.gt(new Dec(111))).toBe(true);
    expect(result.lt(new Dec(112))).toBe(true);
  });

  it("should handle large unit values", () => {
    // unit = 10^15, price = 1, liquidation = 10^15 / 0.9 ≈ 1.111...e15
    const result = LeaseUtils.calculateLiquidation(new Dec("1000000000000000"), new Dec(1));
    expect(result.gt(new Dec("1000000000000000"))).toBe(true);
  });

  it("throws when price is zero (Dec.quo on zero denominator)", () => {
    expect(() => LeaseUtils.calculateLiquidation(new Dec(1), new Dec(0))).toThrow(/Division by zero/);
  });
});

describe("LeaseUtils.calculateLiquidationShort", () => {
  it("should compute unit * 0.9 / price", () => {
    // 1000 * 0.9 / 10 = 90
    const result = LeaseUtils.calculateLiquidationShort(new Dec(1000), new Dec(10));
    expect(decEquals(result, new Dec(90))).toBe(true);
  });

  it("should return value equal to 0.9 of unit when price == 1", () => {
    const result = LeaseUtils.calculateLiquidationShort(new Dec(500), new Dec(1));
    // 500 * 0.9 = 450
    expect(decEquals(result, new Dec(450))).toBe(true);
  });

  it("throws when price is zero (Dec.quo on zero denominator)", () => {
    expect(() => LeaseUtils.calculateLiquidationShort(new Dec(1), new Dec(0))).toThrow(/Division by zero/);
  });
});

describe("LeaseUtils.calculateAditionalDebt", () => {
  it("should compute principal * percent * 180 / 31_536_000", () => {
    // 1000 * 0.1 * 180 / 31536000 = 18000 / 31536000 ≈ 0.00057077625...
    const result = LeaseUtils.calculateAditionalDebt(new Dec(1000), new Dec("0.1"));
    // Verify start of expansion
    expect(result.toString(10).startsWith("0.0005707762")).toBe(true);
  });

  it("should return zero when percent is zero", () => {
    const result = LeaseUtils.calculateAditionalDebt(new Dec(1000), new Dec(0));
    expect(result.isZero()).toBe(true);
  });

  it("should return zero when principal is zero", () => {
    const result = LeaseUtils.calculateAditionalDebt(new Dec(0), new Dec("0.1"));
    expect(result.isZero()).toBe(true);
  });
});

describe("LeaseUtils.additionalInterest", () => {
  it("should return Dec(0) when data is null", () => {
    const result = LeaseUtils.additionalInterest(null);
    expect(result.isZero()).toBe(true);
  });

  it("should compute loan_rate/1000 + margin_rate/100 and feed into calculateAditionalDebt", () => {
    // loan_interest_rate=100 → 100/1000 = 0.1
    // margin_interest_rate=10 → 10/100 = 0.1
    // combined rate = 0.2
    // principal_due = 1000
    // expected: calculateAditionalDebt(1000, 0.2) = 1000 * 0.2 * 180 / 31_536_000 = 36000 / 31_536_000
    const data = {
      loan_interest_rate: 100,
      margin_interest_rate: 10,
      principal_due: { amount: "1000", ticker: "UNLS" }
    };
    // Cast to unknown→OpenedLeaseInfo: we deliberately feed a minimal shape matching the fields used.
    const result = LeaseUtils.additionalInterest(data as unknown as OpenedLeaseInfo);
    const expected = LeaseUtils.calculateAditionalDebt(new Dec(1000), new Dec("0.2"));
    expect(result.toString(18)).toBe(expected.toString(18));
  });

  it("should return zero when both rates are zero", () => {
    const data = {
      loan_interest_rate: 0,
      margin_interest_rate: 0,
      principal_due: { amount: "1000", ticker: "UNLS" }
    };
    const result = LeaseUtils.additionalInterest(data as unknown as OpenedLeaseInfo);
    expect(result.isZero()).toBe(true);
  });

  it("should return zero when principal_due is zero", () => {
    const data = {
      loan_interest_rate: 100,
      margin_interest_rate: 10,
      principal_due: { amount: "0", ticker: "UNLS" }
    };
    const result = LeaseUtils.additionalInterest(data as unknown as OpenedLeaseInfo);
    expect(result.isZero()).toBe(true);
  });
});
