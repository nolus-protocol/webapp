import { describe, it, expect } from "vitest";
import { Decimal } from "./decimal.js";

describe("Decimal.toString truncates toward zero (never rounds)", () => {
  const cases: [string, number, string][] = [
    ["63463.437", 2, "63463.43"],
    ["1.999", 2, "1.99"],
    ["1.5", 2, "1.50"],
    ["-1.567", 2, "-1.56"],
    ["-1.567", 0, "-1"],
    ["100.0", 0, "100"],
    ["0", 2, "0.00"],
    ["123.456789", 4, "123.4567"]
  ];
  for (const [input, prec, expected] of cases) {
    it(`fromString("${input}").toString(${prec.toString()}) === "${expected}"`, () => {
      expect(Decimal.fromString(input).toString(prec)).toBe(expected);
    });
  }
});

describe("Decimal.fromAtomics interprets implied decimals", () => {
  it("micro amount with 8 implied decimals", () => {
    expect(Decimal.fromAtomics("100000000", 8).toString(2)).toBe("1.00");
  });
  it("micro amount toString(0) is the integer part", () => {
    expect(Decimal.fromAtomics("150000000", 8).toString(0)).toBe("1");
  });
  it("rejects a non-integer atomics string", () => {
    expect(() => Decimal.fromAtomics("1.5", 6)).toThrow();
  });
});

describe("Decimal arithmetic truncates like keplr Dec", () => {
  it("mul truncates the 36-dp product back to 18 dp", () => {
    expect(Decimal.fromString("0.1").mul(Decimal.fromString("0.2")).toString(18)).toBe("0.020000000000000000");
  });
  it("quo truncates (1/3 never rounds up the last digit)", () => {
    expect(Decimal.fromString("1").quo(Decimal.fromString("3")).toString(18)).toBe("0.333333333333333333");
  });
  it("add / sub", () => {
    expect(Decimal.fromString("2.5").add(Decimal.fromString("0.25")).toString(2)).toBe("2.75");
    expect(Decimal.fromString("2.5").sub(Decimal.fromString("3")).toString(2)).toBe("-0.50");
  });
  it("division by zero throws", () => {
    expect(() => Decimal.fromString("1").quo(Decimal.zero())).toThrow();
  });
  it("sign predicates", () => {
    expect(Decimal.fromString("-1").isNegative()).toBe(true);
    expect(Decimal.zero().isPositive()).toBe(false);
    expect(Decimal.zero().isZero()).toBe(true);
    expect(Decimal.fromString("2").gte(Decimal.fromString("2"))).toBe(true);
  });
  it("rejects a non-decimal string", () => {
    expect(() => Decimal.fromString("abc")).toThrow();
  });
});
