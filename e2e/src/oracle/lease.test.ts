import { describe, it, expect } from "vitest";
import { Decimal } from "./decimal.js";
import {
  leaseSizeCell,
  positionSecondaryShortMicro,
  computePnl,
  computeLiquidation,
  liquidationRendered
} from "./lease.js";

const d = (value: string): Decimal => Decimal.fromString(value);

describe("leaseSizeCell", () => {
  it("LONG: crypto primary (adaptive), USD sub (2 dp)", () => {
    expect(leaseSizeCell({ positionType: "Long", unitAsset: d("1.5"), assetValueUsd: d("95195.15") })).toEqual({
      value: "1.50",
      subValue: "$95,195.15"
    });
  });
  it("SHORT: USD primary, crypto sub with short name", () => {
    expect(
      leaseSizeCell({
        positionType: "Short",
        unitAsset: d("20000"),
        assetValueUsd: d("20000"),
        cryptoShortName: "BTC",
        cryptoPriceUsd: d("63463.43")
      })
    ).toEqual({ value: "$20,000.00", subValue: "0.31 BTC" });
  });
  it("SHORT with zero price yields the zero fallback", () => {
    expect(
      leaseSizeCell({ positionType: "Short", unitAsset: d("20000"), assetValueUsd: d("20000"), cryptoShortName: "BTC" })
        .subValue
    ).toBe("0.00 BTC");
  });
});

// The list row formats the continuous quotient; the detail widget truncates the crypto to
// an integer micro-amount first. For a repeating quotient the two show a different figure.
describe("list-row vs detail-widget SHORT secondary divergence", () => {
  it("detail widget truncates to token decimals before display", () => {
    const listSub = leaseSizeCell({
      positionType: "Short",
      unitAsset: d("100"),
      assetValueUsd: d("100"),
      cryptoShortName: "X",
      cryptoPriceUsd: d("3")
    }).subValue;
    const micro = positionSecondaryShortMicro(d("100"), d("3"), 6);
    expect(listSub).toBe("33.33333333 X"); // 8 dp of the continuous value
    expect(micro).toBe("33333333"); // truncated to 6 implied decimals -> 33.333333
    expect(Decimal.fromAtomics(micro, 6).toString(6)).toBe("33.333333");
  });
  it("zero price yields a zero micro-amount", () => {
    expect(positionSecondaryShortMicro(d("100"), Decimal.zero(), 6)).toBe("0");
  });
});

describe("computePnl", () => {
  it("standard positive PnL", () => {
    expect(
      computePnl({
        assetValueUsd: d("95000"),
        totalDebtUsd: d("20000"),
        downpayment: d("20000"),
        fee: d("100"),
        repayment: d("0")
      })
    ).toEqual({ amount: "55100.00", percent: "275.50", pnlPositive: true });
  });
  it("exactly zero counts as positive", () => {
    expect(
      computePnl({
        assetValueUsd: d("20100"),
        totalDebtUsd: d("20000"),
        downpayment: d("100"),
        fee: d("0"),
        repayment: d("0")
      })
    ).toEqual({ amount: "0.00", percent: "0.00", pnlPositive: true });
  });
  it("negative PnL", () => {
    const result = computePnl({
      assetValueUsd: d("19000"),
      totalDebtUsd: d("20000"),
      downpayment: d("100"),
      fee: d("0"),
      repayment: d("0")
    });
    expect(result.pnlPositive).toBe(false);
    expect(result.amount).toBe("-1100.00");
  });
  it("zero denominator is the degenerate {0,0,true}", () => {
    expect(
      computePnl({ assetValueUsd: d("5"), totalDebtUsd: d("0"), downpayment: d("0"), fee: d("0"), repayment: d("0") })
    ).toEqual({ amount: "0.00", percent: "0.00", pnlPositive: true });
  });
});

describe("computeLiquidation", () => {
  it("uses the server price as-is when present", () => {
    const price = computeLiquidation({
      serverPrice: "48000.123456",
      positionType: "Long",
      debt: d("1"),
      collateral: d("1")
    });
    expect(price.toString(6)).toBe("48000.123456");
    expect(liquidationRendered(price)).toBe("48,000.12");
  });
  it("derives Long = (debt/collateral)/0.9", () => {
    expect(computeLiquidation({ positionType: "Long", debt: d("18000"), collateral: d("1") }).toString(2)).toBe(
      "20000.00"
    );
  });
  it("derives Short = (collateral*0.9)/debt", () => {
    expect(computeLiquidation({ positionType: "Short", debt: d("2"), collateral: d("20000") }).toString(2)).toBe(
      "9000.00"
    );
  });
  it("degenerate zero inputs yield zero", () => {
    expect(computeLiquidation({ positionType: "Long", debt: d("0"), collateral: d("1") }).isZero()).toBe(true);
  });
});
