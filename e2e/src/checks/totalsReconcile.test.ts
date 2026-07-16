import { describe, expect, it } from "vitest";
import { reconcileTotals } from "./totalsReconcile.js";
import type { BalanceInfo } from "../types.js";

const TOLERANCE = "0.05";
const EXPECTED = { withinToleranceUsd: TOLERANCE };

function balance(amountUsd: string): BalanceInfo {
  return { key: "k", symbol: "s", denom: "d", amount: "1", amount_usd: amountUsd, decimal_digits: 6 };
}

describe("reconcileTotals", () => {
  it("passes when the summed amount_usd equals the reported total", () => {
    const result = reconcileTotals({
      balances: [balance("0.25"), balance("0.75")],
      totalValueUsd: "1.00",
      toleranceUsd: TOLERANCE
    });
    expect(result).toEqual({
      status: "pass",
      observed: { sum: "1", totalValueUsd: "1.00", diff: "0", entryCount: 2 },
      expected: EXPECTED
    });
  });

  it("passes when the summed amount_usd is within tolerance of the total", () => {
    const result = reconcileTotals({
      balances: [balance("0.50"), balance("0.50")],
      totalValueUsd: "1.03",
      toleranceUsd: TOLERANCE
    });
    expect(result).toEqual({
      status: "pass",
      observed: { sum: "1", totalValueUsd: "1.03", diff: "-0.03", entryCount: 2 },
      expected: EXPECTED
    });
  });

  it("fails when the summed amount_usd falls outside tolerance", () => {
    const result = reconcileTotals({
      balances: [balance("0.50"), balance("0.50")],
      totalValueUsd: "1.10",
      toleranceUsd: TOLERANCE
    });
    expect(result).toEqual({
      status: "fail",
      observed: { sum: "1", totalValueUsd: "1.10", diff: "-0.1", entryCount: 2 },
      expected: EXPECTED
    });
  });

  it("passes with a degenerate note when there are no balances", () => {
    const result = reconcileTotals({ balances: [], totalValueUsd: "0", toleranceUsd: TOLERANCE });
    expect(result).toEqual({
      status: "pass",
      observed: { sum: "0", totalValueUsd: "0", diff: "0", entryCount: 0 },
      expected: EXPECTED,
      note: "0 balances for the configured address: reconciliation is degenerate"
    });
  });
});
