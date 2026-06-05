import { describe, it, expect } from "vitest";
import type { LeaseInfo } from "@/common/api";
import { computeChartLiquidationPrice } from "./liquidationLine";

function lease(overrides: Partial<LeaseInfo> = {}): LeaseInfo {
  return {
    address: "nolus1abc",
    protocol: "OSMOSIS-OSMOSIS-ALL_BTC",
    status: "opened",
    amount: { ticker: "ALL_BTC", amount: "100000000" }, // 1 BTC at 8 decimals
    debt: {
      ticker: "USDC_NOBLE",
      principal: "56700000000", // 56,700 USDC at 6 decimals
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "0",
      due_interest: "0",
      total: "56700000000"
    },
    interest: { loan_rate: 0, margin_rate: 0, annual_rate_percent: 0 },
    ...overrides
  } as LeaseInfo;
}

describe("computeChartLiquidationPrice", () => {
  it("Long: (debt / collateral) / 0.9 — below spot, not inflated", () => {
    // 56,700 / 1 / 0.9 = 63,000
    const result = computeChartLiquidationPrice(lease(), {
      positionType: "Long",
      unitDecimals: 8,
      stableDecimals: 6
    });
    expect(result).toBeCloseTo(63000, 6);
  });

  it("Short: (collateral * 0.9) / debt", () => {
    // collateral 1 (unit), debt 0.5 (stable) -> 1 * 0.9 / 0.5 = 1.8
    const result = computeChartLiquidationPrice(
      lease({
        amount: { ticker: "USDC_NOBLE", amount: "100000000" },
        debt: {
          ticker: "ALL_BTC",
          principal: "50000000",
          overdue_margin: "0",
          overdue_interest: "0",
          due_margin: "0",
          due_interest: "0",
          total: "50000000"
        }
      }),
      { positionType: "Short", unitDecimals: 8, stableDecimals: 8 }
    );
    expect(result).toBeCloseTo(1.8, 6);
  });

  it("prefers an explicit backend liquidation_price when present", () => {
    const result = computeChartLiquidationPrice(lease({ liquidation_price: "61234.5" }), {
      positionType: "Long",
      unitDecimals: 8,
      stableDecimals: 6
    });
    expect(result).toBe(61234.5);
  });

  it("returns 0 for a lease that is not opened", () => {
    expect(
      computeChartLiquidationPrice(lease({ status: "opening" }), {
        positionType: "Long",
        unitDecimals: 8,
        stableDecimals: 6
      })
    ).toBe(0);
  });

  it("returns 0 when collateral or debt is zero", () => {
    expect(
      computeChartLiquidationPrice(lease({ amount: { ticker: "ALL_BTC", amount: "0" } }), {
        positionType: "Long",
        unitDecimals: 8,
        stableDecimals: 6
      })
    ).toBe(0);
  });

  it("returns 0 for a null lease", () => {
    expect(computeChartLiquidationPrice(null, { positionType: "Long", unitDecimals: 8, stableDecimals: 6 })).toBe(0);
  });
});
