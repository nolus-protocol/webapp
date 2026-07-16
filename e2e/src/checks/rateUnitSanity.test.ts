import { describe, expect, it } from "vitest";
import { checkLeaseRates } from "./rateUnitSanity.js";
import type { InterestInfo } from "../types.js";

const MIN = 0;
const MAX = 100;

function interest(loanRate: number, marginRate: number, annualRatePercent: number): InterestInfo {
  return { loan_rate: loanRate, margin_rate: marginRate, annual_rate_percent: annualRatePercent };
}

describe("checkLeaseRates", () => {
  it("passes the reference lease where 17.4 == (94 + 80) / 10", () => {
    expect(checkLeaseRates([interest(94, 80, 17.4)], MIN, MAX).status).toBe("pass");
  });

  it("passes a real staging lease where 3.3 == (8 + 25) / 10", () => {
    expect(checkLeaseRates([interest(8, 25, 3.3000000000000003)], MIN, MAX).status).toBe("pass");
  });

  it("fails and flags the #270 permille-leak signature for an integer rate >= 100", () => {
    const result = checkLeaseRates([interest(940, 800, 174)], MIN, MAX);
    expect(result.status).toBe("fail");
    expect(result.observed).toMatchObject({
      inspectedCount: 1,
      failures: [
        {
          index: 0,
          annualRatePercent: 174,
          permilleLeakSignature: true
        }
      ]
    });
  });

  it("fails when the annual rate exceeds the plausibility band", () => {
    const result = checkLeaseRates([interest(1000, 505, 150.5)], MIN, MAX);
    expect(result.status).toBe("fail");
    expect(result.observed).toMatchObject({ failures: [{ permilleLeakSignature: false }] });
  });

  it("fails when the annual rate is below the configured minimum", () => {
    const result = checkLeaseRates([interest(8, 25, 3.3)], 5, MAX);
    expect(result.status).toBe("fail");
  });

  it("fails when the permille identity does not hold", () => {
    const result = checkLeaseRates([interest(8, 25, 99.9)], MIN, MAX);
    expect(result.status).toBe("fail");
    expect(result.observed).toMatchObject({ failures: [{ permilleLeakSignature: false }] });
  });

  it("passes with a degenerate note when no leases carry interest", () => {
    const result = checkLeaseRates([], MIN, MAX);
    expect(result.status).toBe("pass");
    expect(result.note).toBe("0 leases inspected: degenerate");
  });
});
