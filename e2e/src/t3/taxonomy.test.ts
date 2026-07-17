import { describe, expect, it } from "vitest";
import { classify } from "./taxonomy.js";

describe("classify environment", () => {
  it("classifies an HTTP 429 status as environment", () => {
    expect(classify({ message: "request failed", status: 429 }).category).toBe("environment");
  });

  it("classifies rate-limit text, relayer delay, price move and node-down as environment", () => {
    expect(classify({ message: "Too Many Requests" }).signal).toBe("rate-limited");
    expect(classify({ message: "IBC packet not relayed yet" }).category).toBe("environment");
    expect(classify({ message: "quote expired: price moved out of tolerance" }).category).toBe("environment");
    expect(classify({ message: "connect ETIMEDOUT waiting for RPC" }).category).toBe("environment");
    expect(classify({ message: "timed out waiting for chain state" }).signal).toBe("chain-state-timeout");
  });
});

describe("classify app", () => {
  it("classifies an assertion failure as app", () => {
    expect(classify({ message: "expected true toBe false" }).category).toBe("app");
  });

  it("defaults an unrecognized failure to app", () => {
    expect(classify({ message: "the widget rendered upside down" })).toMatchObject({
      category: "app",
      signal: "unclassified"
    });
  });
});

describe("classify precondition", () => {
  it("classifies unfunded, unbonding-entry cap and redelegation lock as precondition", () => {
    expect(classify({ message: "account is unfunded" }).category).toBe("precondition");
    expect(classify({ message: "too many unbonding delegation entries" }).signal).toBe("unbonding-entry-cap");
    expect(classify({ message: "redelegation is in progress for this delegator" }).signal).toBe("redelegation-lock");
    expect(classify({ message: "missing osmosis balance for the swap leg" }).category).toBe("precondition");
  });

  it("classifies a lease down-payment range rejection as precondition", () => {
    expect(classify({ message: "down payment is below the minimum for this lease" }).signal).toBe("lease-amount-range");
    expect(classify({ message: "downpayment too large, out of range" }).category).toBe("precondition");
  });

  it("classifies a dust swap with no routable amount as precondition, distinct from a liquidity outage", () => {
    expect(classify({ message: "amount too small to route" }).signal).toBe("swap-amount-too-small");
    expect(classify({ message: "insufficient liquidity, no route found" }).signal).toBe("liquidity");
  });
});

describe("classify redaction", () => {
  it("redacts an embedded IP from the stored reason while keeping the environment signal", () => {
    const result = classify({ message: "connect ECONNREFUSED 10.1.2.3:26657" });
    expect(result.category).toBe("environment");
    expect(result.signal).toBe("node-unavailable");
    expect(result.reason).not.toContain("10.1.2.3");
    expect(result.reason).toContain("ECONNREFUSED");
  });

  it("redacts a specific rpc host when one is provided", () => {
    const result = classify({
      message: "dial tcp rpc.internal.example:26657 refused",
      rpcUrl: "http://rpc.internal.example:26657"
    });
    expect(result.reason).not.toContain("rpc.internal.example");
  });

  it("reads the message from an Error instance", () => {
    expect(classify({ error: new Error("HTTP 503 from upstream") }).category).toBe("environment");
  });
});
