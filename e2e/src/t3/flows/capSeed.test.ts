import { describe, expect, it } from "vitest";
import { capDenomOf, seedCapFromJournal } from "./capSeed.js";
import { SpendCap } from "../spendCap.js";
import { buildIntent, buildOutcome } from "../journal.js";
import type { IntentAction, JournalRecord, WalletRole } from "../journal.js";

function intent(seq: number, action: IntentAction, denom: string, micro: string): JournalRecord {
  const role: WalletRole = "primary";
  return buildIntent({
    seq,
    ts: "2026-07-17T12:00:00.000Z",
    spec: "flow",
    walletRole: role,
    action,
    denoms: [{ denom, micro }]
  });
}

describe("capDenomOf", () => {
  it("maps native and USDC denoms and skips anything uncapped", () => {
    expect(capDenomOf("unls")).toBe("nls");
    expect(capDenomOf("ibc/usdc")).toBe("usdc");
    expect(capDenomOf("IBC/AABBUSDCcc")).toBe("usdc");
    expect(capDenomOf("uatom")).toBeUndefined();
  });
});

describe("seedCapFromJournal", () => {
  it("restores the cap spent-state from committed outcomes only", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    const records: JournalRecord[] = [
      intent(1, "native-send", "unls", "100"),
      buildOutcome({ seq: 1, ts: "t", status: "committed" }),
      intent(2, "lease-open", "ibc/usdc", "400"),
      buildOutcome({ seq: 2, ts: "t", status: "committed" }),
      intent(3, "swap", "unls", "50"),
      buildOutcome({ seq: 3, ts: "t", status: "failed" }),
      intent(4, "lease-open", "ibc/usdc", "999"),
      buildOutcome({ seq: 4, ts: "t", status: "aborted" })
    ];
    seedCapFromJournal(cap, records);
    expect(cap.spent("nls")).toBe(100n);
    expect(cap.spent("usdc")).toBe(400n);
  });

  it("leaves the cap untouched when there are no committed outcomes", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    seedCapFromJournal(cap, [intent(1, "native-send", "unls", "100")]);
    expect(cap.spent("nls")).toBe(0n);
  });

  it("ignores an uncapped denom in a committed intent", () => {
    const cap = new SpendCap({ nls: 1000n, usdc: 1000n });
    seedCapFromJournal(cap, [
      intent(1, "delegate", "uatom", "100"),
      buildOutcome({ seq: 1, ts: "t", status: "committed" })
    ]);
    expect(cap.spent("nls")).toBe(0n);
    expect(cap.spent("usdc")).toBe(0n);
  });
});
