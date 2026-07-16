import { describe, expect, it } from "vitest";
import { compareWithinTolerance, isDecimalString, isNonNegativeDecimalString, sumDecimalStrings } from "./decimal.js";

describe("sumDecimalStrings", () => {
  it("adds representative decimals without binary-float drift", () => {
    expect(sumDecimalStrings(["0.1", "0.2"])).toBe("0.3");
  });

  it("returns 0 for an empty list", () => {
    expect(sumDecimalStrings([])).toBe("0");
  });

  it("sums high-precision usd strings exactly", () => {
    expect(sumDecimalStrings(["0", "0.00033486001896998756", "0.0000722555059071227", "0.07", "0"])).toBe(
      "0.07040711552487711026"
    );
  });
});

describe("compareWithinTolerance", () => {
  it("treats a difference equal to the tolerance as within", () => {
    expect(compareWithinTolerance({ actual: "1.00", expected: "1.05", tolerance: "0.05" })).toEqual({
      within: true,
      diff: "-0.05"
    });
  });

  it("treats a difference just past the tolerance as outside", () => {
    expect(compareWithinTolerance({ actual: "1.06", expected: "1.00", tolerance: "0.05" })).toEqual({
      within: false,
      diff: "0.06"
    });
  });

  it("reports an exact zero difference as within a zero tolerance", () => {
    expect(
      compareWithinTolerance({ actual: "0.07040711552487712", expected: "0.07040711552487712", tolerance: "0" })
    ).toEqual({ within: true, diff: "0" });
  });
});

describe("isDecimalString", () => {
  it("accepts plain and negative decimals", () => {
    expect(isDecimalString("-12.5")).toBe(true);
  });

  it("rejects scientific notation", () => {
    expect(isDecimalString("1e-7")).toBe(false);
  });
});

describe("isNonNegativeDecimalString", () => {
  it("accepts a non-negative decimal", () => {
    expect(isNonNegativeDecimalString("0.05")).toBe(true);
  });

  it("rejects a negative decimal", () => {
    expect(isNonNegativeDecimalString("-0.05")).toBe(false);
  });

  it("rejects scientific notation that parseDecimal would later reject", () => {
    expect(isNonNegativeDecimalString("1e-7")).toBe(false);
  });
});
