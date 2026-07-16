import { describe, expect, it } from "vitest";
import { classifyBalanceUpdate, parseFrame } from "./ws.js";

const WIRE_ADDRESS = "nolus1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

function wireBalanceUpdate(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "balance_update",
    chain: "nolus",
    address: WIRE_ADDRESS,
    balances: [{ key: "NLS", symbol: "NLS", denom: "unls", amount: "1000000", amount_usd: "0.01", decimal_digits: 6 }],
    total_value_usd: "0.01",
    timestamp: "2026-07-16T00:00:00Z",
    ...overrides
  });
}

describe("parseFrame", () => {
  it("parses a subscribed ack frame", () => {
    expect(parseFrame(JSON.stringify({ type: "subscribed", topic: "balances" }))).toEqual({
      type: "subscribed",
      topic: "balances"
    });
  });

  it("parses an error frame with code and message", () => {
    expect(parseFrame(JSON.stringify({ type: "error", code: "bad", message: "nope" }))).toEqual({
      type: "error",
      code: "bad",
      message: "nope"
    });
  });

  it("parses a frame delivered as a Buffer", () => {
    expect(parseFrame(Buffer.from(JSON.stringify({ type: "subscribed", topic: "balances" })))).toEqual({
      type: "subscribed",
      topic: "balances"
    });
  });

  it("drops non-string optional fields rather than trusting them", () => {
    expect(parseFrame(JSON.stringify({ type: "subscribed", topic: 5 }))).toEqual({ type: "subscribed" });
  });

  it("returns null for a non-JSON payload", () => {
    expect(parseFrame("{not json")).toBeNull();
  });

  it("returns null for a JSON array", () => {
    expect(parseFrame(JSON.stringify(["a", "b"]))).toBeNull();
  });

  it("returns null when type is not a string", () => {
    expect(parseFrame(JSON.stringify({ type: 1 }))).toBeNull();
  });
});

describe("classifyBalanceUpdate", () => {
  it("classifies a byte-exact wire balance_update as an update with every field intact", () => {
    const outcome = classifyBalanceUpdate(wireBalanceUpdate(), WIRE_ADDRESS);
    expect(outcome).toEqual({
      kind: "update",
      update: {
        chain: "nolus",
        address: WIRE_ADDRESS,
        balances: [
          { key: "NLS", symbol: "NLS", denom: "unls", amount: "1000000", amount_usd: "0.01", decimal_digits: 6 }
        ],
        total_value_usd: "0.01",
        timestamp: "2026-07-16T00:00:00Z"
      }
    });
  });

  it("classifies a wire frame delivered as a Buffer identically", () => {
    const outcome = classifyBalanceUpdate(Buffer.from(wireBalanceUpdate()), WIRE_ADDRESS);
    expect(outcome).toMatchObject({ kind: "update" });
  });

  it("reports a balance_update missing a required field as malformed, not ignored", () => {
    const frame = JSON.parse(wireBalanceUpdate()) as Record<string, unknown>;
    delete frame.total_value_usd;
    const outcome = classifyBalanceUpdate(JSON.stringify(frame), WIRE_ADDRESS);
    expect(outcome).toEqual({ kind: "malformed", detail: "balance_update.total_value_usd must be a string" });
  });

  it("reports a balance_update with a wrong-typed balances entry as malformed", () => {
    const outcome = classifyBalanceUpdate(wireBalanceUpdate({ balances: [{ denom: "unls" }] }), WIRE_ADDRESS);
    expect(outcome).toEqual({ kind: "malformed", detail: "balance_update.balances[0].key must be a string" });
  });

  it("ignores a valid balance_update for a different address", () => {
    const other = wireBalanceUpdate({ address: "nolus1zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" });
    expect(classifyBalanceUpdate(other, WIRE_ADDRESS)).toEqual({ kind: "none" });
  });

  it("ignores control frames and non-JSON payloads", () => {
    expect(classifyBalanceUpdate(JSON.stringify({ type: "subscribed", topic: "balances" }), WIRE_ADDRESS)).toEqual({
      kind: "none"
    });
    expect(classifyBalanceUpdate("{not json", WIRE_ADDRESS)).toEqual({ kind: "none" });
  });
});
