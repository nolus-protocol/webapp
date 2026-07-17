import { describe, it, expect } from "vitest";
import { toMicroAmount, makeSendCoin, makeFee, sanitizeRpc, NATIVE_DENOM } from "./transfer.js";

describe("toMicroAmount", () => {
  it("scales a fractional amount to integer micro units", () => {
    expect(toMicroAmount("0.001")).toBe("1000");
    expect(toMicroAmount("1")).toBe("1000000");
    expect(toMicroAmount("0.000001")).toBe("1");
    expect(toMicroAmount("12.345678")).toBe("12345678");
  });

  it("honours a non-default decimal scale", () => {
    expect(toMicroAmount("1.5", 2)).toBe("150");
    expect(toMicroAmount("3", 0)).toBe("3");
  });

  it("treats zero as convertible (positivity is enforced elsewhere)", () => {
    expect(toMicroAmount("0")).toBe("0");
    expect(toMicroAmount("0.0")).toBe("0");
  });

  it("rejects a non-decimal or negative string", () => {
    expect(() => toMicroAmount("abc")).toThrow(/non-negative decimal/);
    expect(() => toMicroAmount("-1")).toThrow(/non-negative decimal/);
    expect(() => toMicroAmount("")).toThrow(/non-negative decimal/);
  });

  it("rejects more fractional digits than the denom carries", () => {
    expect(() => toMicroAmount("0.0000001")).toThrow(/fractional digits/);
  });
});

describe("makeSendCoin", () => {
  it("builds a positive coin in the native denom", () => {
    expect(makeSendCoin("0.001")).toEqual({ denom: NATIVE_DENOM, amount: "1000" });
  });

  it("honours a custom denom", () => {
    expect(makeSendCoin("2", "ibc/ABC", 6)).toEqual({ denom: "ibc/ABC", amount: "2000000" });
  });

  it("rejects a non-positive amount", () => {
    expect(() => makeSendCoin("0")).toThrow(/positive/);
    expect(() => makeSendCoin("0.000")).toThrow(/positive/);
  });
});

describe("makeFee", () => {
  it("computes ceil(gasLimit * gasPrice) in the fee denom", () => {
    expect(makeFee(200000, "0.025")).toEqual({ amount: [{ denom: NATIVE_DENOM, amount: "5000" }], gas: "200000" });
  });

  it("rounds the fee up, never down", () => {
    // 100001 * 0.025 = 2500.025 -> ceil 2501
    expect(makeFee(100001, "0.025").amount[0]?.amount).toBe("2501");
  });

  it("handles an integer gas price", () => {
    expect(makeFee(100, "2")).toEqual({ amount: [{ denom: NATIVE_DENOM, amount: "200" }], gas: "100" });
  });

  it("rejects a non-positive gas limit or bad price", () => {
    expect(() => makeFee(0, "0.025")).toThrow(/positive integer/);
    expect(() => makeFee(1.5, "0.025")).toThrow(/positive integer/);
    expect(() => makeFee(100, "x")).toThrow(/non-negative decimal/);
  });
});

describe("sanitizeRpc", () => {
  it("strips the full url and the bare host", () => {
    const rpc = "https://rpc.nolus.network";
    expect(sanitizeRpc(`POST ${rpc} failed`, rpc)).toBe("POST <rpc> failed");
    expect(sanitizeRpc("connect rpc.nolus.network:443 refused", rpc)).toBe("connect <rpc>:443 refused");
  });

  it("strips an embedded credential host form", () => {
    const rpc = "https://user:secret@rpc.internal:26657";
    const out = sanitizeRpc(`broadcast to ${rpc} timed out`, rpc);
    expect(out).not.toContain("secret");
    expect(out).toContain("<rpc>");
  });

  it("is a no-op when the text has no rpc reference", () => {
    expect(sanitizeRpc("plain error", "https://rpc.nolus.network")).toBe("plain error");
  });

  it("tolerates an unparseable rpc value", () => {
    expect(sanitizeRpc("boom not-a-url here", "not-a-url")).toBe("boom <rpc> here");
  });
});
