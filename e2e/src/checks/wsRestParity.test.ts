import { describe, expect, it } from "vitest";
import { compareBalanceSnapshots } from "./wsRestParity.js";
import type { BalanceInfo } from "../types.js";

function balance(denom: string, amount: string, amountUsd: string): BalanceInfo {
  return { key: denom, symbol: denom, denom, amount, amount_usd: amountUsd, decimal_digits: 6 };
}

describe("compareBalanceSnapshots", () => {
  it("passes when the (denom, amount) sets and totals match", () => {
    const ws = { balances: [balance("unls", "100", "0.5")], totalValueUsd: "0.5" };
    const rest = { balances: [balance("unls", "100", "0.5")], totalValueUsd: "0.5" };
    expect(compareBalanceSnapshots(ws, rest, 0.05).status).toBe("pass");
  });

  it("fails and names the denom when an amount differs", () => {
    const ws = { balances: [balance("unls", "101", "0.5")], totalValueUsd: "0.5" };
    const rest = { balances: [balance("unls", "100", "0.5")], totalValueUsd: "0.5" };
    const result = compareBalanceSnapshots(ws, rest, 0.05);
    expect(result.status).toBe("fail");
    expect(result.observed).toEqual({
      source: "ws",
      totalValueUsd: "0.5",
      onlyInWs: [{ denom: "unls", amount: "101" }],
      totalDiff: "0",
      totalWithinTolerance: true
    });
    expect(result.expected).toEqual({
      source: "rest",
      totalValueUsd: "0.5",
      onlyInRest: [{ denom: "unls", amount: "100" }]
    });
  });

  it("fails when the ws side has an extra denom", () => {
    const ws = { balances: [balance("unls", "100", "0.5"), balance("uatom", "5", "0")], totalValueUsd: "0.5" };
    const rest = { balances: [balance("unls", "100", "0.5")], totalValueUsd: "0.5" };
    const result = compareBalanceSnapshots(ws, rest, 0.05);
    expect(result.status).toBe("fail");
    expect(result.observed).toMatchObject({ onlyInWs: [{ denom: "uatom", amount: "5" }] });
  });

  it("fails when a denom is present only on the rest side", () => {
    const ws = { balances: [balance("unls", "100", "0.5")], totalValueUsd: "0.5" };
    const rest = { balances: [balance("unls", "100", "0.5"), balance("uatom", "5", "0")], totalValueUsd: "0.5" };
    const result = compareBalanceSnapshots(ws, rest, 0.05);
    expect(result.status).toBe("fail");
    expect(result.expected).toMatchObject({ onlyInRest: [{ denom: "uatom", amount: "5" }] });
  });

  it("fails when totals diverge beyond tolerance despite equal sets", () => {
    const ws = { balances: [balance("unls", "100", "0.60")], totalValueUsd: "0.60" };
    const rest = { balances: [balance("unls", "100", "0.50")], totalValueUsd: "0.50" };
    const result = compareBalanceSnapshots(ws, rest, 0.05);
    expect(result.status).toBe("fail");
    expect(result.observed).toMatchObject({ totalWithinTolerance: false, totalDiff: "0.1" });
  });

  it("passes when totals diverge within tolerance and sets match", () => {
    const ws = { balances: [balance("unls", "100", "0.53")], totalValueUsd: "0.53" };
    const rest = { balances: [balance("unls", "100", "0.50")], totalValueUsd: "0.50" };
    expect(compareBalanceSnapshots(ws, rest, 0.05).status).toBe("pass");
  });
});
