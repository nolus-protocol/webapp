import { describe, expect, it } from "vitest";
import { assertNonZeroBasis, assertWithinTolerance, withinTolerance } from "./tolerance.js";

describe("withinTolerance", () => {
  it("accepts a value inside the tolerance band", () => {
    const result = withinTolerance({ actual: "100.02", expected: "100.00", tolerance: "0.05" });
    expect(result.ok).toBe(true);
    expect(result.deltaAbs).toBe("0.02000000");
  });

  it("accepts a value exactly on the tolerance boundary", () => {
    expect(withinTolerance({ actual: "100.05", expected: "100.00", tolerance: "0.05" }).ok).toBe(true);
  });

  it("rejects a value beyond the tolerance band regardless of sign", () => {
    expect(withinTolerance({ actual: "100.06", expected: "100.00", tolerance: "0.05" }).ok).toBe(false);
    expect(withinTolerance({ actual: "99.94", expected: "100.00", tolerance: "0.05" }).ok).toBe(false);
  });

  it("rejects a negative tolerance", () => {
    expect(() => withinTolerance({ actual: "1", expected: "1", tolerance: "-0.1" })).toThrow(/non-negative/);
  });
});

describe("tolerance self-test — a deliberately wrong value on a non-zero basis must fail", () => {
  it("rejects a rendered figure that is off by more than tolerance on a priced value", () => {
    const basis = "1543.21";
    assertNonZeroBasis({ value: basis, description: "collateral leg" });
    const result = withinTolerance({ actual: "1600.00", expected: basis, tolerance: "0.05" });
    expect(result.ok).toBe(false);
    expect(() => {
      assertWithinTolerance({ actual: "1600.00", expected: basis, tolerance: "0.05" }, "liquidation");
    }).toThrow(/outside tolerance/);
  });
});

describe("assertNonZeroBasis", () => {
  it("throws when the oracle basis is zero so a vacuous NLS-USD assertion is caught", () => {
    expect(() => {
      assertNonZeroBasis({ value: "0", description: "nls usd value" });
    }).toThrow(/vacuous/);
    expect(() => {
      assertNonZeroBasis({ value: "0.00", description: "nls usd value" });
    }).toThrow(/vacuous/);
  });

  it("passes a non-zero basis", () => {
    expect(() => {
      assertNonZeroBasis({ value: "42.5", description: "collateral" });
    }).not.toThrow();
  });
});
