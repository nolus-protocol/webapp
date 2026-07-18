import { describe, expect, it } from "vitest";
import { assembleLeftoverReport } from "./report.js";
import { buildIntent, buildOutcome } from "./journal.js";
import type { JournalRecord } from "./journal.js";

const swapIntent = (seq: number): JournalRecord =>
  buildIntent({
    seq,
    ts: "t",
    spec: "t3-engine",
    walletRole: "primary",
    action: "swap",
    denoms: [{ denom: "unls", micro: "5" }],
    rpcUrl: ""
  });

describe("assembleLeftoverReport", () => {
  it("emits open leases, pending unbondings, unfinished swaps and spend on a terminal path", () => {
    const journal: JournalRecord[] = [
      swapIntent(1),
      buildOutcome({ seq: 1, ts: "t", status: "committed", rpcUrl: "" }),
      swapIntent(2)
    ];
    const report = assembleLeftoverReport({
      generatedAt: "2026-07-17T00:00:00.000Z",
      terminal: "spend-cap-abort",
      journal,
      openLeases: [{ address: "nolus1lease", protocol: "OSMOSIS", status: "opened" }],
      pendingUnbondings: [{ validatorAddress: "nolusvaloper1", entries: 2, balanceMicro: "1500" }],
      spend: [{ denom: "nls", capMicro: 1_000_000n, spentMicro: 5n }],
      warnings: ["wallet-2 low"]
    });

    expect(report).toEqual({
      suite: "t3",
      version: 1,
      generatedAt: "2026-07-17T00:00:00.000Z",
      terminal: "spend-cap-abort",
      openLeases: [{ address: "nolus1lease", protocol: "OSMOSIS", status: "opened" }],
      pendingUnbondings: [{ validatorAddress: "nolusvaloper1", entries: 2, balanceMicro: "1500" }],
      unfinishedSwaps: [{ seq: 2, spec: "t3-engine", denoms: [{ denom: "unls", micro: "5" }] }],
      spend: [{ denom: "nls", capMicro: "1000000", spentMicro: "5" }],
      warnings: ["wallet-2 low"]
    });
  });

  it("reports no unfinished swaps when every swap intent settled", () => {
    const journal: JournalRecord[] = [
      swapIntent(1),
      buildOutcome({ seq: 1, ts: "t", status: "committed", rpcUrl: "" })
    ];
    const report = assembleLeftoverReport({
      generatedAt: "t",
      terminal: "success",
      journal,
      openLeases: [],
      pendingUnbondings: [],
      spend: [],
      warnings: []
    });
    expect(report.unfinishedSwaps).toEqual([]);
  });
});
