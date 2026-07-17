import { describe, expect, it } from "vitest";
import { seedCapFromJournal } from "./capSeed.js";
import { SpendCap } from "../spendCap.js";
import { buildIntent, buildOutcome } from "../journal.js";
import type { DenomAmount, IntentAction, JournalRecord } from "../journal.js";

function chargedIntent(seq: number, action: IntentAction, charged: DenomAmount[]): JournalRecord {
  return buildIntent({
    seq,
    ts: "2026-07-17T12:00:00.000Z",
    spec: "flow",
    walletRole: "primary",
    action,
    denoms: [],
    charged
  });
}

describe("seedCapFromJournal", () => {
  it("restores the cap spent-state from committed intents' charged field only", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    const records: JournalRecord[] = [
      chargedIntent(1, "native-send", [{ denom: "nls", micro: "100" }]),
      buildOutcome({ seq: 1, ts: "t", status: "committed" }),
      chargedIntent(2, "lease-open", [{ denom: "usdc", micro: "400" }]),
      buildOutcome({ seq: 2, ts: "t", status: "committed" }),
      chargedIntent(3, "swap", [{ denom: "nls", micro: "50" }]),
      buildOutcome({ seq: 3, ts: "t", status: "failed" }),
      chargedIntent(4, "lease-open", [{ denom: "usdc", micro: "999" }]),
      buildOutcome({ seq: 4, ts: "t", status: "aborted" })
    ];
    seedCapFromJournal(cap, records);
    expect(cap.spent("nls")).toBe(100n);
    expect(cap.spent("usdc")).toBe(400n);
  });

  it("ignores display denoms and never re-charges a zero-charge inflow action on restart", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    const records: JournalRecord[] = [
      buildIntent({
        seq: 1,
        ts: "t",
        spec: "flow",
        walletRole: "primary",
        action: "undelegate",
        denoms: [{ denom: "unls", micro: "5000000" }],
        charged: [{ denom: "nls", micro: "0" }]
      }),
      buildOutcome({ seq: 1, ts: "t", status: "committed" })
    ];
    seedCapFromJournal(cap, records);
    expect(cap.spent("nls")).toBe(0n);
    expect(cap.spent("usdc")).toBe(0n);
  });

  it("leaves the cap untouched when there are no committed outcomes", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    seedCapFromJournal(cap, [chargedIntent(1, "native-send", [{ denom: "nls", micro: "100" }])]);
    expect(cap.spent("nls")).toBe(0n);
  });

  it("ignores an uncapped denom in a committed intent's charged field", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    seedCapFromJournal(cap, [
      chargedIntent(1, "delegate", [{ denom: "uatom", micro: "100" }]),
      buildOutcome({ seq: 1, ts: "t", status: "committed" })
    ]);
    expect(cap.spent("nls")).toBe(0n);
    expect(cap.spent("usdc")).toBe(0n);
  });
});
