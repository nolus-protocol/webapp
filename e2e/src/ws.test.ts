import { describe, expect, it } from "vitest";
import { parseFrame } from "./ws.js";

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
