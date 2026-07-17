import { describe, expect, it } from "vitest";
import { classifyPricedBalances } from "./pricedBalancesNonzero.js";
import type { PricedBalanceCase } from "./pricedBalancesNonzero.js";

function priced(denom: string, ticker: string, amountMicro: string, amountUsd: string): PricedBalanceCase {
  return { denom, ticker, amountMicro, amountUsd, priced: true };
}

describe("classifyPricedBalances", () => {
  it("passes when every priced, non-zero balance has a positive amount_usd", () => {
    const result = classifyPricedBalances([
      priced("ibc/USDC", "USDC_NOBLE", "74577016", "74.58"),
      priced("unls", "NLS", "6506577367", "7.98")
    ]);
    expect(result.status).toBe("pass");
    expect(result.observed).toEqual({ checkedCount: 2, exemptCount: 0, offenders: [] });
    expect(result.note).toBeUndefined();
  });

  it("fails when a priced, non-zero balance reports amount_usd of 0 (the USD-join regression)", () => {
    const result = classifyPricedBalances([
      priced("ibc/USDC", "USDC_NOBLE", "74577016", "0"),
      priced("unls", "NLS", "6506577367", "7.98")
    ]);
    expect(result.status).toBe("fail");
    expect(result.observed.offenders).toEqual([
      { denom: "ibc/USDC", ticker: "USDC_NOBLE", amountMicro: "74577016", amountUsd: "0" }
    ]);
    expect(result.observed.checkedCount).toBe(2);
  });

  it("exempts zero-balance entries even when the ticker is priced", () => {
    const result = classifyPricedBalances([priced("ibc/USDC", "USDC_NOBLE", "0", "0")]);
    expect(result.status).toBe("pass");
    expect(result.observed).toEqual({ checkedCount: 0, exemptCount: 1, offenders: [] });
    expect(result.note).toContain("degenerate");
  });

  it("exempts entries whose ticker has no price key", () => {
    const result = classifyPricedBalances([
      { denom: "ibc/FOO", ticker: "FOO", amountMicro: "1000000", amountUsd: "0", priced: false }
    ]);
    expect(result.status).toBe("pass");
    expect(result.observed).toEqual({ checkedCount: 0, exemptCount: 1, offenders: [] });
  });

  it("exempts entries whose denom did not resolve to a ticker", () => {
    const result = classifyPricedBalances([
      { denom: "ibc/UNKNOWN", ticker: undefined, amountMicro: "1000000", amountUsd: "0", priced: false }
    ]);
    expect(result.status).toBe("pass");
    expect(result.observed.exemptCount).toBe(1);
  });

  it("treats a non-numeric amount_usd on a checked entry as a failure", () => {
    const result = classifyPricedBalances([priced("ibc/USDC", "USDC_NOBLE", "74577016", "NaN")]);
    expect(result.status).toBe("fail");
    expect(result.observed.offenders).toHaveLength(1);
  });

  it("passes with a degenerate note when there are no cases at all", () => {
    const result = classifyPricedBalances([]);
    expect(result.status).toBe("pass");
    expect(result.observed).toEqual({ checkedCount: 0, exemptCount: 0, offenders: [] });
    expect(result.note).toContain("degenerate");
  });
});
