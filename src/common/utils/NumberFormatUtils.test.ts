import { describe, it, expect } from "vitest";
import { Dec, type CoinPretty } from "@keplr-wallet/unit";
import * as NF from "./NumberFormatUtils";

/**
 * NumberFormatUtils is locale-aware (en-US). Tests assume en-US grouping (commas)
 * and decimal point (.) — matches NATIVE_CURRENCY.locale default.
 */

describe("formatNumber", () => {
  it("should format integer with 2 decimals", () => {
    expect(NF.formatNumber(1234, 2)).toBe("1,234.00");
  });

  it("should prepend symbol when provided", () => {
    expect(NF.formatNumber(1234, 2, "$")).toBe("$1,234.00");
  });

  it("should use en-US grouping", () => {
    expect(NF.formatNumber(1234567.89, 2)).toBe("1,234,567.89");
  });

  it("should return zero with symbol and given decimals for NaN", () => {
    expect(NF.formatNumber(NaN, 4, "$")).toBe("$0.0000");
  });

  it("should return '0.000' for NaN with decimals=3 and no symbol", () => {
    expect(NF.formatNumber(NaN, 3)).toBe("0.000");
  });

  it("should return '0' for NaN with decimals=0", () => {
    // "0." + "0".repeat(0) = "0."
    expect(NF.formatNumber(NaN, 0)).toBe("0.");
  });

  it("should preserve negative sign", () => {
    const out = NF.formatNumber(-42.5, 2);
    expect(out.startsWith("-")).toBe(true);
    expect(out).toContain("42.50");
  });

  it("should pass +Infinity through as '∞' (no guard — documents FINDING-3)", () => {
    // Math.abs(Infinity) = Infinity; Intl.NumberFormat en-US formats Infinity as "∞"
    expect(NF.formatNumber(Infinity, 2, "$")).toBe("$∞");
  });

  it("should preserve negative Infinity as '-∞'", () => {
    expect(NF.formatNumber(-Infinity, 2)).toBe("-∞");
  });

  it("should respect decimals=0", () => {
    expect(NF.formatNumber(1234, 0)).toBe("1,234");
  });

  it("should accept string input", () => {
    expect(NF.formatNumber("123.456", 2)).toBe("123.46");
  });
});

describe("currencyFormatOptions", () => {
  it("should return min and max equal to input decimals", () => {
    expect(NF.currencyFormatOptions(6)).toEqual({
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  });
});

describe("tokenFormatOptions", () => {
  it("should return min=2 and max=input maxDecimals", () => {
    expect(NF.tokenFormatOptions(4)).toEqual({
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  });
});

describe("formatToken", () => {
  it("should format with minimum 2 decimals", () => {
    expect(NF.formatToken(1.5, 6)).toBe("1.50");
  });

  it("should trim to maxDecimals", () => {
    expect(NF.formatToken(1.123456789, 4)).toBe("1.1235");
  });

  it("should return literal 'NaN' for NaN (no guard — documents absence of NaN guard)", () => {
    expect(NF.formatToken(NaN, 4)).toBe("NaN");
  });
});

describe("compactFormatOptions", () => {
  it("should be the constant {notation:'compact', compactDisplay:'short', min:2, max:2}", () => {
    expect(NF.compactFormatOptions.notation).toBe("compact");
    expect(NF.compactFormatOptions.compactDisplay).toBe("short");
    expect(NF.compactFormatOptions.minimumFractionDigits).toBe(2);
    expect(NF.compactFormatOptions.maximumFractionDigits).toBe(2);
  });
});

describe("formatDecAsUsd", () => {
  it("should format Dec as $X,YYY.ZZ", () => {
    expect(NF.formatDecAsUsd(new Dec("1234.56"))).toBe("$1,234.56");
  });

  it("should truncate Dec to 2 decimals", () => {
    // Dec.toString(2) truncates, so "1.23456" → "1.23"
    expect(NF.formatDecAsUsd(new Dec("1.23456"))).toBe("$1.23");
  });

  it("should format zero as $0.00", () => {
    expect(NF.formatDecAsUsd(new Dec(0))).toBe("$0.00");
  });
});

describe("formatCompact", () => {
  it("should format 1500 as '1.50K' (compactFormatOptions keeps min=2 decimals)", () => {
    expect(NF.formatCompact(1500)).toBe("1.50K");
  });

  it("should format 2_500_000 as '2.50M'", () => {
    expect(NF.formatCompact(2500000)).toBe("2.50M");
  });

  it("should accept a locale override (falls through to locale-dependent output)", () => {
    // Don't assert specific compact form — jsdom's ICU for non-en-US may not have
    // compact symbols and fall back to full formatting. Just verify it doesn't throw
    // and returns a string that contains a digit.
    const out = NF.formatCompact(1500, "de-DE");
    expect(typeof out).toBe("string");
    expect(out).toMatch(/\d/);
  });
});

describe("formatPercent", () => {
  it("should append % and use given decimals", () => {
    expect(NF.formatPercent(12.345, 2)).toBe("12.35%");
  });

  it("should default to 2 decimals", () => {
    expect(NF.formatPercent(12.345)).toBe("12.35%");
  });

  it("should return '0.00%' for NaN", () => {
    expect(NF.formatPercent(NaN)).toBe("0.00%");
  });
});

describe("getDecimals", () => {
  it.each<[string, number]>([
    ["10000", 2],
    ["9999.99", 4],
    ["1000", 4],
    ["999.999", 6],
    ["100", 6],
    ["99.99", 8],
    ["0", 8]
  ])("should return correct decimals for Dec(%s)", (input, expected) => {
    expect(NF.getDecimals(new Dec(input))).toBe(expected);
  });
});

describe("formatUsd", () => {
  it("should format positive as $X,XXX.YY", () => {
    expect(NF.formatUsd(1234.5)).toBe("$1,234.50");
  });

  it("should format negative as -$X,XXX.YY (sign precedes symbol)", () => {
    // formatNumber places sign before symbol
    expect(NF.formatUsd(-1234.5)).toBe("-$1,234.50");
  });

  it("should format zero as $0.00", () => {
    expect(NF.formatUsd(0)).toBe("$0.00");
  });
});

describe("formatTokenBalance", () => {
  it("should return '0.00' for Dec(0)", () => {
    expect(NF.formatTokenBalance(new Dec(0))).toBe("0.00");
  });

  it("should use 2-decimal path for values >= 10000", () => {
    // abs >= 10000 → getDecimals returns 2
    expect(NF.formatTokenBalance(new Dec(10001))).toBe("10,001.00");
  });

  it("should use 4-decimal path for values in [1000, 10000)", () => {
    // abs=1234.5678 → getDecimals = 4
    expect(NF.formatTokenBalance(new Dec("1234.5678"))).toBe("1,234.5678");
  });

  it("should compute first-sig-digit + 2 for values < 1", () => {
    // 0.00123 → afterDot="00123000", firstSigIdx=2 → decimals=min(2+2,8)=4
    // Dec(0.00123).toString(4) = "0.0012"; trimmed with min=2 → "0.0012"
    expect(NF.formatTokenBalance(new Dec("0.00123"))).toBe("0.0012");
  });

  it("should cap at 8 decimals for very small values", () => {
    // 0.000000001 → afterDot at 8 decimals = "00000000", firstSigIdx=-1 → "0.00"
    expect(NF.formatTokenBalance(new Dec("0.000000001"))).toBe("0.00");
  });

  it("should return '0.00' for values below 8-decimal precision", () => {
    // Beyond MAX_DECIMALS=8, first-sig search returns -1, fallback to "0.00"
    expect(NF.formatTokenBalance(new Dec("0.0000000001"))).toBe("0.00");
  });

  it("should preserve negative sign for negative values", () => {
    const out = NF.formatTokenBalance(new Dec(-5));
    expect(out.startsWith("-")).toBe(true);
    expect(out).toContain("5");
  });
});

describe("getAdaptivePriceDecimals", () => {
  it.each<[number, number]>([
    [0, 2],
    [10000, 2],
    [9999, 4],
    [1, 4],
    [0.5, 2], // 0.50000000 → afterDot="50000000", firstSigIdx=0 → 0+2=2
    [0.05, 3], // "05000000" → firstSigIdx=1 → 1+2=3
    [0.00005, 6], // "00005000" → firstSigIdx=4 → 4+2=6
    [0.0000000001, 2] // below toFixed(8) precision → firstSigIdx=-1 → 2
  ])("should return %i decimals for amount=%s", (input, expected) => {
    expect(NF.getAdaptivePriceDecimals(input)).toBe(expected);
  });

  it("should use absolute value for negative inputs", () => {
    // -10000 → abs >= 10000 → 2
    expect(NF.getAdaptivePriceDecimals(-10000)).toBe(2);
    // -0.5 → same as 0.5
    expect(NF.getAdaptivePriceDecimals(-0.5)).toBe(2);
  });
});

describe("formatPrice", () => {
  it("should return '0.00' for 0", () => {
    expect(NF.formatPrice(0)).toBe("0.00");
  });

  it("should return '0.00' for NaN", () => {
    expect(NF.formatPrice(NaN)).toBe("0.00");
  });

  it("should use adaptive 4-decimal path for values >= 1", () => {
    // 1.23456 → maxDec=4 → toFixed(4) = "1.2346"
    expect(NF.formatPrice(1.23456)).toBe("1.2346");
  });

  it("should use adaptive 2-decimal path for values >= 10000", () => {
    // 12345.6789 → maxDec=2 → toFixed(2) = "12345.68"
    expect(NF.formatPrice(12345.6789)).toBe("12,345.68");
  });

  it("should use first-significant-digit path for small values", () => {
    // 0.00123 → maxDec=4 (firstSigIdx=2) → toFixed(4)="0.0012" → trimmed with min=2 → "0.0012"
    expect(NF.formatPrice(0.00123)).toBe("0.0012");
  });
});

describe("formatPriceUsd", () => {
  it("should format positive as $X.YY", () => {
    expect(NF.formatPriceUsd(1234.5)).toBe("$1,234.50");
  });

  it("should format negative as -$X.YY with sign before symbol", () => {
    expect(NF.formatPriceUsd(-1234.5)).toBe("-$1,234.50");
  });

  it("should format zero as $0.00", () => {
    expect(NF.formatPriceUsd(0)).toBe("$0.00");
  });
});

describe("formatCoinPretty", () => {
  it("should format '<amount> <denom>' using formatTokenBalance and .denom", () => {
    // Minimal CoinPretty-shaped stub: toDec() returns Dec, .denom is string.
    const coin = {
      toDec: () => new Dec("123.45"),
      denom: "USDC"
    };
    expect(NF.formatCoinPretty(coin as unknown as CoinPretty)).toBe("123.45 USDC");
  });

  it("should emit '0.00 <denom>' for a zero coin", () => {
    const coin = {
      toDec: () => new Dec(0),
      denom: "UNLS"
    };
    expect(NF.formatCoinPretty(coin as unknown as CoinPretty)).toBe("0.00 UNLS");
  });
});

describe("formatMobileAmount", () => {
  it("should use compact notation when abs >= 1000", () => {
    // compactFormatOptions keeps min=2 decimals → "2.50K"
    expect(NF.formatMobileAmount(new Dec(2500))).toBe("2.50K");
  });

  it("should fall back to formatTokenBalance when abs < 1000", () => {
    // Dec(999) → formatTokenBalance (>=1 path, 6-decimal getDecimals threshold)
    // getDecimals: 999 < 1000 → 6 decimals; trimmed to min 2 → "999.00"
    expect(NF.formatMobileAmount(new Dec(999))).toBe("999.00");
  });

  it("should use compact for negative large values and keep sign", () => {
    expect(NF.formatMobileAmount(new Dec(-2500))).toBe("-2.50K");
  });
});

describe("formatMobileUsd", () => {
  it("should prefix $ and use compact when abs >= 1000", () => {
    expect(NF.formatMobileUsd(new Dec(2500))).toBe("$2.50K");
  });

  it("should fall back to formatUsd when abs < 1000", () => {
    expect(NF.formatMobileUsd(new Dec(999))).toBe("$999.00");
  });
});
