import { describe, expect, it } from "vitest";
import { checkLeaseRates } from "./rateUnitSanity.js";
import type { RateBand } from "./rateUnitSanity.js";
import type { InterestInfo } from "../types.js";

const FULL_BAND: RateBand = { minPercent: 0, maxPercent: 100 };

function interest(loanRate: number, marginRate: number, annualRatePercent: number): InterestInfo {
  return { loan_rate: loanRate, margin_rate: marginRate, annual_rate_percent: annualRatePercent };
}

function expectedFor(minPercent: number, maxPercent: number): unknown {
  return {
    band: { minPercent, maxPercentExclusive: maxPercent },
    identity: "annual_rate_percent == (loan_rate + margin_rate) / 10",
    identityEpsilon: 1e-6
  };
}

describe("checkLeaseRates", () => {
  it("passes the reference lease where 17.4 == (94 + 80) / 10", () => {
    expect(checkLeaseRates([interest(94, 80, 17.4)], FULL_BAND)).toEqual({
      status: "pass",
      observed: { inspectedCount: 1 },
      expected: expectedFor(0, 100)
    });
  });

  it("passes a real staging lease where 3.3 == (8 + 25) / 10", () => {
    expect(checkLeaseRates([interest(8, 25, 3.3000000000000003)], FULL_BAND)).toEqual({
      status: "pass",
      observed: { inspectedCount: 1 },
      expected: expectedFor(0, 100)
    });
  });

  it("fails and flags the #270 permille-leak signature for an integer rate >= 100", () => {
    expect(checkLeaseRates([interest(940, 800, 174)], FULL_BAND)).toEqual({
      status: "fail",
      observed: {
        inspectedCount: 1,
        failures: [
          {
            index: 0,
            loanRate: 940,
            marginRate: 800,
            annualRatePercent: 174,
            reasons: [
              "annual_rate_percent 174 outside band [0, 100)",
              "annual_rate_percent 174 is an integer >= 100, matches the #270 raw-permille leak signature"
            ],
            permilleLeakSignature: true
          }
        ]
      },
      expected: expectedFor(0, 100)
    });
  });

  it("fails when the annual rate exceeds the plausibility band", () => {
    expect(checkLeaseRates([interest(1000, 505, 150.5)], FULL_BAND)).toEqual({
      status: "fail",
      observed: {
        inspectedCount: 1,
        failures: [
          {
            index: 0,
            loanRate: 1000,
            marginRate: 505,
            annualRatePercent: 150.5,
            reasons: ["annual_rate_percent 150.5 outside band [0, 100)"],
            permilleLeakSignature: false
          }
        ]
      },
      expected: expectedFor(0, 100)
    });
  });

  it("fails when the annual rate is below the configured minimum", () => {
    expect(checkLeaseRates([interest(8, 25, 3.3)], { minPercent: 5, maxPercent: 100 })).toEqual({
      status: "fail",
      observed: {
        inspectedCount: 1,
        failures: [
          {
            index: 0,
            loanRate: 8,
            marginRate: 25,
            annualRatePercent: 3.3,
            reasons: ["annual_rate_percent 3.3 outside band [5, 100)"],
            permilleLeakSignature: false
          }
        ]
      },
      expected: expectedFor(5, 100)
    });
  });

  it("fails when the permille identity does not hold", () => {
    expect(checkLeaseRates([interest(8, 25, 99.9)], FULL_BAND)).toEqual({
      status: "fail",
      observed: {
        inspectedCount: 1,
        failures: [
          {
            index: 0,
            loanRate: 8,
            marginRate: 25,
            annualRatePercent: 99.9,
            reasons: ["annual_rate_percent 99.9 != (loan_rate + margin_rate) / 10 = 3.3"],
            permilleLeakSignature: false
          }
        ]
      },
      expected: expectedFor(0, 100)
    });
  });

  it("passes with a degenerate note when no leases carry interest", () => {
    expect(checkLeaseRates([], FULL_BAND)).toEqual({
      status: "pass",
      observed: { inspectedCount: 0 },
      expected: expectedFor(0, 100),
      note: "0 leases inspected: degenerate"
    });
  });
});
