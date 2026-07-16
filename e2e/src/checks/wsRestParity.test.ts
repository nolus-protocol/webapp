import { describe, expect, it } from "vitest";
import { compareBalanceSnapshots } from "./wsRestParity.js";
import type { BalanceSnapshot } from "./wsRestParity.js";
import type { BalanceInfo } from "../types.js";

const TOLERANCE = "0.05";

function balance(denom: string, amount: string, amountUsd: string): BalanceInfo {
  return { key: denom, symbol: denom, denom, amount, amount_usd: amountUsd, decimal_digits: 6 };
}

function snapshot(balances: BalanceInfo[], totalValueUsd: string): BalanceSnapshot {
  return { balances, totalValueUsd };
}

describe("compareBalanceSnapshots", () => {
  it("passes when the (denom, amount) sets and totals match", () => {
    const ws = snapshot([balance("unls", "100", "0.5")], "0.5");
    const rest = snapshot([balance("unls", "100", "0.5")], "0.5");
    expect(compareBalanceSnapshots({ ws, rest, toleranceUsd: TOLERANCE })).toEqual({ status: "pass" });
  });

  it("fails and names the denom when an amount differs", () => {
    const ws = snapshot([balance("unls", "101", "0.5")], "0.5");
    const rest = snapshot([balance("unls", "100", "0.5")], "0.5");
    expect(compareBalanceSnapshots({ ws, rest, toleranceUsd: TOLERANCE })).toEqual({
      status: "fail",
      observed: {
        source: "ws",
        totalValueUsd: "0.5",
        onlyInWs: [{ denom: "unls", amount: "101" }],
        totalDiff: "0",
        totalWithinTolerance: true
      },
      expected: {
        source: "rest",
        totalValueUsd: "0.5",
        onlyInRest: [{ denom: "unls", amount: "100" }]
      }
    });
  });

  it("fails when the ws side has an extra denom", () => {
    const ws = snapshot([balance("unls", "100", "0.5"), balance("uatom", "5", "0")], "0.5");
    const rest = snapshot([balance("unls", "100", "0.5")], "0.5");
    expect(compareBalanceSnapshots({ ws, rest, toleranceUsd: TOLERANCE })).toEqual({
      status: "fail",
      observed: {
        source: "ws",
        totalValueUsd: "0.5",
        onlyInWs: [{ denom: "uatom", amount: "5" }],
        totalDiff: "0",
        totalWithinTolerance: true
      },
      expected: { source: "rest", totalValueUsd: "0.5", onlyInRest: [] }
    });
  });

  it("fails when a denom is present only on the rest side", () => {
    const ws = snapshot([balance("unls", "100", "0.5")], "0.5");
    const rest = snapshot([balance("unls", "100", "0.5"), balance("uatom", "5", "0")], "0.5");
    expect(compareBalanceSnapshots({ ws, rest, toleranceUsd: TOLERANCE })).toEqual({
      status: "fail",
      observed: {
        source: "ws",
        totalValueUsd: "0.5",
        onlyInWs: [],
        totalDiff: "0",
        totalWithinTolerance: true
      },
      expected: { source: "rest", totalValueUsd: "0.5", onlyInRest: [{ denom: "uatom", amount: "5" }] }
    });
  });

  it("fails when totals diverge beyond tolerance despite equal sets", () => {
    const ws = snapshot([balance("unls", "100", "0.60")], "0.60");
    const rest = snapshot([balance("unls", "100", "0.50")], "0.50");
    expect(compareBalanceSnapshots({ ws, rest, toleranceUsd: TOLERANCE })).toEqual({
      status: "fail",
      observed: {
        source: "ws",
        totalValueUsd: "0.60",
        onlyInWs: [],
        totalDiff: "0.1",
        totalWithinTolerance: false
      },
      expected: { source: "rest", totalValueUsd: "0.50", onlyInRest: [] }
    });
  });

  it("passes when totals diverge within tolerance and sets match", () => {
    const ws = snapshot([balance("unls", "100", "0.53")], "0.53");
    const rest = snapshot([balance("unls", "100", "0.50")], "0.50");
    expect(compareBalanceSnapshots({ ws, rest, toleranceUsd: TOLERANCE })).toEqual({ status: "pass" });
  });
});
