import { describe, it, expect } from "vitest";
import { Decimal } from "./decimal.js";
import { animatedFixed, animatedCompact, animatedToken } from "./animated.js";

describe("animated aria-label paths", () => {
  it("fixed carries the absolute value at fixed decimals (no sign)", () => {
    expect(animatedFixed("1234.567", 2)).toBe("1,234.57");
    expect(animatedFixed("-1234.5", 2)).toBe("1,234.50");
  });

  it("compact headline is the absolute compact value", () => {
    expect(animatedCompact("386919.0787393914")).toBe("386.92K");
    expect(animatedCompact("-360973.19")).toBe("360.97K");
  });

  describe("token double-round (truncate to raw, then re-round to adaptive)", () => {
    it("re-rounds when adaptive < raw (large value, adaptive 2)", () => {
      // raw 8 dp truncation keeps ...43789100; adaptive 2 dp then rounds up to .44.
      expect(animatedToken(Decimal.fromString("63463.437891"), 8)).toBe("63,463.44");
    });
    it("is a no-op when adaptive >= raw (sub-100 value, adaptive 8)", () => {
      expect(animatedToken(Decimal.fromString("1.23456789"), 8)).toBe("1.23456789");
    });
  });
});
