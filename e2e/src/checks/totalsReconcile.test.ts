import { describe, expect, it } from "vitest";
import { reconcileTotals } from "./totalsReconcile.js";
import type { BalanceInfo } from "../types.js";

function balance(amountUsd: string): BalanceInfo {
  return { key: "k", symbol: "s", denom: "d", amount: "1", amount_usd: amountUsd, decimal_digits: 6 };
}

describe("reconcileTotals", () => {
  it("passes when the summed amount_usd equals the reported total", () => {
    const result = reconcileTotals([balance("0.25"), balance("0.75")], "1.00", 0.05);
    expect(result.status).toBe("pass");
    expect(result.observed).toEqual({ sum: "1", totalValueUsd: "1.00", diff: "0", entryCount: 2 });
  });

  it("passes when the summed amount_usd is within tolerance of the total", () => {
    const result = reconcileTotals([balance("0.50"), balance("0.50")], "1.03", 0.05);
    expect(result.status).toBe("pass");
    expect(result.observed).toMatchObject({ diff: "-0.03" });
  });

  it("fails when the summed amount_usd falls outside tolerance", () => {
    const result = reconcileTotals([balance("0.50"), balance("0.50")], "1.10", 0.05);
    expect(result.status).toBe("fail");
    expect(result.observed).toMatchObject({ diff: "-0.1" });
  });

  it("passes with a degenerate note when there are no balances", () => {
    const result = reconcileTotals([], "0", 0.05);
    expect(result.status).toBe("pass");
    expect(result.note).toBe("0 balances for the configured address: reconciliation is degenerate");
    expect(result.observed).toMatchObject({ entryCount: 0 });
  });
});
