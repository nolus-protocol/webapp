import { describe, it, expect } from "vitest";
import type { LeaseHistoryEntry, LeaseInfo } from "@/common/api";
import {
  buildLiquidationSteps,
  computeChartLiquidationPrice,
  liquidationAt,
  liquidationLabelFor,
  type LiquidationStep
} from "./liquidationLine";

function historyEntry(overrides: Partial<LeaseHistoryEntry> = {}): LeaseHistoryEntry {
  return {
    action: "liquidation",
    timestamp: "2026-01-01T00:00:00Z",
    liquidation_price: "79257.5",
    ...overrides
  };
}

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

const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);
const T1 = Date.UTC(2026, 0, 2, 0, 0, 0);
const T2 = Date.UTC(2026, 0, 3, 0, 0, 0);

describe("buildLiquidationSteps", () => {
  it("returns [] for null history", () => {
    expect(buildLiquidationSteps(null)).toEqual([]);
  });

  it("returns [] for undefined history", () => {
    expect(buildLiquidationSteps(undefined)).toEqual([]);
  });

  it("returns [] for empty history", () => {
    expect(buildLiquidationSteps([])).toEqual([]);
  });

  it("maps an entry to its epoch-ms time and whole-unit price", () => {
    const steps = buildLiquidationSteps([
      historyEntry({ timestamp: "2026-01-01T00:00:00Z", liquidation_price: "79257.5" })
    ]);
    expect(steps).toEqual([{ time: T0, price: 79257.5 }]);
  });

  it("uses liquidation_price as-is with no decimal scaling", () => {
    const steps = buildLiquidationSteps([historyEntry({ liquidation_price: "79257.5" })]);
    expect(steps.map((s) => s.price)).toEqual([79257.5]);
  });

  it("drops an entry whose liquidation_price is undefined", () => {
    expect(buildLiquidationSteps([historyEntry({ liquidation_price: undefined })])).toEqual([]);
  });

  it('drops an entry whose liquidation_price is "0" (fully-repaid event)', () => {
    expect(buildLiquidationSteps([historyEntry({ liquidation_price: "0" })])).toEqual([]);
  });

  it("drops an entry whose liquidation_price parses to a negative value", () => {
    expect(buildLiquidationSteps([historyEntry({ liquidation_price: "-5" })])).toEqual([]);
  });

  it("drops an entry whose liquidation_price parses to non-finite", () => {
    expect(buildLiquidationSteps([historyEntry({ liquidation_price: "not-a-number" })])).toEqual([]);
  });

  it("drops an entry whose timestamp is missing", () => {
    expect(buildLiquidationSteps([historyEntry({ timestamp: undefined })])).toEqual([]);
  });

  it("drops an entry whose timestamp is unparseable", () => {
    expect(buildLiquidationSteps([historyEntry({ timestamp: "not-a-date" })])).toEqual([]);
  });

  it("returns steps sorted ascending by time when history is out of order", () => {
    const steps = buildLiquidationSteps([
      historyEntry({ timestamp: "2026-01-03T00:00:00Z", liquidation_price: "75679" }),
      historyEntry({ timestamp: "2026-01-01T00:00:00Z", liquidation_price: "79257" }),
      historyEntry({ timestamp: "2026-01-02T00:00:00Z", liquidation_price: "81003" })
    ]);
    expect(steps).toEqual([
      { time: T0, price: 79257 },
      { time: T1, price: 81003 },
      { time: T2, price: 75679 }
    ]);
  });

  it("yields exactly the positive steps in time order for a realistic mixed history", () => {
    const steps = buildLiquidationSteps([
      historyEntry({ action: "open", timestamp: "2025-12-31T00:00:00Z", liquidation_price: undefined }),
      historyEntry({ action: "liquidation", timestamp: "2026-01-01T00:00:00Z", liquidation_price: "79257" }),
      historyEntry({ action: "liquidation", timestamp: "2026-01-02T00:00:00Z", liquidation_price: "81003" }),
      historyEntry({ action: "liquidation", timestamp: "2026-01-03T00:00:00Z", liquidation_price: "75679" }),
      historyEntry({ action: "repay", timestamp: "2026-01-04T00:00:00Z", liquidation_price: "0" })
    ]);
    expect(steps).toEqual([
      { time: T0, price: 79257 },
      { time: T1, price: 81003 },
      { time: T2, price: 75679 }
    ]);
  });
});

describe("liquidationAt", () => {
  const steps: LiquidationStep[] = [
    { time: T0, price: 79257 },
    { time: T1, price: 81003 },
    { time: T2, price: 75679 }
  ];

  it("returns null for empty steps when active", () => {
    expect(liquidationAt([], T1, true)).toBeNull();
  });

  it("returns null for empty steps when inactive", () => {
    expect(liquidationAt([], T1, false)).toBeNull();
  });

  it("returns null before the first step when active", () => {
    expect(liquidationAt(steps, T0 - 1, true)).toBeNull();
  });

  it("returns null before the first step when inactive", () => {
    expect(liquidationAt(steps, T0 - 1, false)).toBeNull();
  });

  it("returns the step's price exactly at its time (inclusive lower bound)", () => {
    expect(liquidationAt(steps, T0, true)).toBe(79257);
  });

  it("returns the earlier step's price between two steps", () => {
    expect(liquidationAt(steps, T0 + 1, true)).toBe(79257);
  });

  it("returns the most-recent step's price at a later step's exact time", () => {
    expect(liquidationAt(steps, T1, true)).toBe(81003);
  });

  it("returns the last step's price after the last step when active", () => {
    expect(liquidationAt(steps, T2 + 1, true)).toBe(75679);
  });

  it("returns null after the last step when inactive", () => {
    expect(liquidationAt(steps, T2 + 1, false)).toBeNull();
  });
});

describe("liquidationLabelFor", () => {
  const steps: LiquidationStep[] = [
    { time: T0, price: 79257 },
    { time: T1, price: 81003 }
  ];

  it("uses the stepped value as a string when a series exists", () => {
    expect(liquidationLabelFor(steps, 63000, T1, true)).toBe("81003");
  });

  it("returns null inside a series where there is no active trigger (gap), ignoring the flat fallback", () => {
    // Before the first step: a gap, even though a positive flat value is available.
    expect(liquidationLabelFor(steps, 63000, T0 - 1, true)).toBeNull();
  });

  it("falls back to the flat value as a string when there is no series", () => {
    expect(liquidationLabelFor([], 63000, T1, true)).toBe("63000");
  });

  it("returns null when there is neither a series nor a positive flat value", () => {
    expect(liquidationLabelFor([], 0, T1, true)).toBeNull();
  });
});
