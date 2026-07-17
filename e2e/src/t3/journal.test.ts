import { describe, expect, it } from "vitest";
import { buildIntent, buildOutcome, parseRecords, serializeRecord, unmatchedIntents } from "./journal.js";
import type { JournalRecord } from "./journal.js";

describe("buildIntent", () => {
  it("builds a write-ahead intent and omits an absent memo", () => {
    const intent = buildIntent({
      seq: 1,
      ts: "2026-07-17T00:00:00.000Z",
      spec: "t3-engine",
      walletRole: "primary",
      action: "native-send",
      denoms: [{ denom: "unls", micro: "1000" }]
    });
    expect(intent).toEqual({
      type: "intent",
      seq: 1,
      ts: "2026-07-17T00:00:00.000Z",
      spec: "t3-engine",
      walletRole: "primary",
      action: "native-send",
      denoms: [{ denom: "unls", micro: "1000" }]
    });
    expect("memo" in intent).toBe(false);
  });

  it("redacts an IP that leaks into the spec or memo", () => {
    const intent = buildIntent({
      seq: 2,
      ts: "2026-07-17T00:00:00.000Z",
      spec: "run against 10.9.8.7:26657",
      walletRole: "secondary",
      action: "swap",
      denoms: [{ denom: "unls", micro: "1" }],
      memo: "node 10.9.8.7"
    });
    expect(intent.spec).not.toContain("10.9.8.7");
    expect(intent.memo).not.toContain("10.9.8.7");
  });
});

describe("buildOutcome", () => {
  it("records a committed outcome with tx hash and height", () => {
    const outcome = buildOutcome({
      seq: 1,
      ts: "2026-07-17T00:00:01.000Z",
      status: "committed",
      txHash: "ABC",
      height: 42
    });
    expect(outcome).toEqual({
      type: "outcome",
      seq: 1,
      ts: "2026-07-17T00:00:01.000Z",
      status: "committed",
      txHash: "ABC",
      height: 42
    });
  });

  it("redacts an IP inside a classified failure reason", () => {
    const outcome = buildOutcome({
      seq: 3,
      ts: "2026-07-17T00:00:02.000Z",
      status: "failed",
      failure: { category: "environment", signal: "node-unavailable", reason: "ECONNREFUSED 10.0.0.1:26657" }
    });
    expect(outcome.failure?.reason).not.toContain("10.0.0.1");
  });
});

describe("serialize / parse round-trip", () => {
  it("serializes to one JSON line each and parses back, ignoring blanks", () => {
    const records: JournalRecord[] = [
      buildIntent({ seq: 1, ts: "t", spec: "s", walletRole: "primary", action: "swap", denoms: [] }),
      buildOutcome({ seq: 1, ts: "t2", status: "committed" })
    ];
    const jsonl = `${records.map(serializeRecord).join("\n")}\n\n`;
    expect(parseRecords(jsonl)).toEqual(records);
  });

  it("skips a corrupt line (torn JSON) and a valid-JSON-but-wrong-shape line, keeping the good ones", () => {
    const good = buildIntent({ seq: 7, ts: "t", spec: "s", walletRole: "primary", action: "swap", denoms: [] });
    const jsonl = [serializeRecord(good), '{"type":"intent","seq":8', '{"foo":"bar"}', "42"].join("\n");
    expect(parseRecords(jsonl)).toEqual([good]);
  });
});

describe("unmatchedIntents", () => {
  it("returns intents with no settling outcome — the crash-surviving write-ahead entries", () => {
    const records: JournalRecord[] = [
      buildIntent({ seq: 1, ts: "t", spec: "s", walletRole: "primary", action: "swap", denoms: [] }),
      buildOutcome({ seq: 1, ts: "t", status: "committed" }),
      buildIntent({ seq: 2, ts: "t", spec: "s", walletRole: "primary", action: "swap", denoms: [] })
    ];
    expect(unmatchedIntents(records).map((intent) => intent.seq)).toEqual([2]);
  });
});
