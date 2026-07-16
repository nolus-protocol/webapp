import { describe, expect, it } from "vitest";
import { compareWithinTolerance, sumDecimalStrings } from "./decimal.js";

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
    const result = compareWithinTolerance("1.00", "1.05", 0.05);
    expect(result).toEqual({ within: true, diff: "-0.05" });
  });

  it("treats a difference just past the tolerance as outside", () => {
    const result = compareWithinTolerance("1.06", "1.00", 0.05);
    expect(result).toEqual({ within: false, diff: "0.06" });
  });

  it("reports an exact zero difference as within any non-negative tolerance", () => {
    const result = compareWithinTolerance("0.07040711552487712", "0.07040711552487712", 0);
    expect(result).toEqual({ within: true, diff: "0" });
  });
});
