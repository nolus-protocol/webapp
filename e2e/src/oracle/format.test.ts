import { describe, it, expect } from "vitest";
import { Decimal } from "./decimal.js";
import {
  formatNumber,
  formatDecAsUsd,
  formatUsd,
  formatCompact,
  formatPercent,
  formatTokenBalance,
  formatPrice,
  formatPriceUsd,
  getDecimals,
  getAdaptivePriceDecimals,
  formatMobileAmount,
  formatMobileUsd
} from "./format.js";

describe("formatNumber", () => {
  it("groups and fixes decimals with sign and symbol", () => {
    expect(formatNumber("1234.5", 2, "$")).toBe("$1,234.50");
    expect(formatNumber("-1234.5", 2, "$")).toBe("-$1,234.50");
  });
  it("NaN falls back to zero-padded, ungrouped", () => {
    expect(formatNumber("nope", 2, "$")).toBe("$0.00");
  });
});

describe("compact rounding at the boundaries", () => {
  const cases: [number, string][] = [
    [999.996, "1.00K"],
    [9999.995, "10.00K"],
    [1000, "1.00K"],
    [386919.0787393914, "386.92K"],
    [179918523.986, "179.92M"],
    [1234.56, "1.23K"]
  ];
  for (const [input, expected] of cases) {
    it(`formatCompact(${input.toString()}) === "${expected}"`, () => {
      expect(formatCompact(input)).toBe(expected);
    });
  }
});

// The subtlest split on the money surface: two USD paths for the same input, one truncates
// and one rounds. A key-swap between them would show a one-cent difference.
describe("truncate-vs-round divergence", () => {
  it("formatDecAsUsd truncates, formatUsd rounds (same input)", () => {
    const value = "63463.437";
    expect(formatDecAsUsd(Decimal.fromString(value))).toBe("$63,463.43");
    expect(formatUsd(value)).toBe("$63,463.44");
  });
  it("formatTokenBalance truncates, formatPrice rounds (same input)", () => {
    const value = "63463.437";
    expect(formatTokenBalance(Decimal.fromString(value))).toBe("63,463.43");
    expect(formatPrice(value)).toBe("63,463.44");
  });
});

describe("formatTokenBalance adaptive decimals (truncating, trimmed)", () => {
  const cases: [string, string][] = [
    ["0", "0.00"],
    ["63463.437", "63,463.43"],
    ["1234.5678", "1,234.5678"],
    ["1.5", "1.50"],
    ["0.0012308127", "0.0012"],
    ["0.315143", "0.31"]
  ];
  for (const [input, expected] of cases) {
    it(`formatTokenBalance("${input}") === "${expected}"`, () => {
      expect(formatTokenBalance(Decimal.fromString(input))).toBe(expected);
    });
  }
});

describe("prices and percentages", () => {
  it("formatPrice adaptive (small keeps precision, large rounds to 2)", () => {
    expect(formatPrice("0.0012308127")).toBe("0.0012");
    expect(formatPriceUsd("63463.437")).toBe("$63,463.44");
  });
  it("formatPercent", () => {
    expect(formatPercent("5.25")).toBe("5.25%");
    expect(formatPercent("16")).toBe("16.00%");
  });
  it("getDecimals thresholds", () => {
    expect(getDecimals(Decimal.fromString("10000"))).toBe(2);
    expect(getDecimals(Decimal.fromString("1000"))).toBe(4);
    expect(getDecimals(Decimal.fromString("100"))).toBe(6);
    expect(getDecimals(Decimal.fromString("99.9"))).toBe(8);
  });
  it("getAdaptivePriceDecimals", () => {
    expect(getAdaptivePriceDecimals(0)).toBe(2);
    expect(getAdaptivePriceDecimals(50000)).toBe(2);
    expect(getAdaptivePriceDecimals(5)).toBe(4);
    expect(getAdaptivePriceDecimals(0.00045)).toBe(5);
  });
});

describe("mobile mixed modes", () => {
  it("compact >= 1000, token/usd otherwise", () => {
    expect(formatMobileAmount(Decimal.fromString("1234.56"))).toBe("1.23K");
    expect(formatMobileAmount(Decimal.fromString("12.5"))).toBe("12.50");
    expect(formatMobileUsd(Decimal.fromString("1234.56"))).toBe("$1.23K");
    expect(formatMobileUsd(Decimal.fromString("12.5"))).toBe("$12.50");
  });
});
