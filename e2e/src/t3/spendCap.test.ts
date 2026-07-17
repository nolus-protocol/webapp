import { describe, expect, it } from "vitest";
import { SpendCap, spendCapFromMicros } from "./spendCap.js";
import type { SpendItem } from "./spendCap.js";

const nls = (micro: bigint): SpendItem => ({ denom: "nls", micro });
const usdc = (micro: bigint): SpendItem => ({ denom: "usdc", micro });

describe("SpendCap.check", () => {
  it("passes a candidate within cap and reports the over-denom when it exceeds", () => {
    const cap = new SpendCap({ nls: 1_000_000n, usdc: 0n });
    expect(cap.check([nls(999_999n)])).toEqual({ ok: true });

    const over = cap.check([nls(1_000_001n)]);
    expect(over).toEqual({ ok: false, overDenom: "nls", projectedMicro: 1_000_001n, capMicro: 1_000_000n });
  });

  it("aborts a swap that attaches a zero-cap denom (usdc cap 0)", () => {
    const cap = new SpendCap({ nls: 1_000_000n, usdc: 0n });
    const check = cap.check([nls(1000n), usdc(1n)]);
    expect(check).toEqual({ ok: false, overDenom: "usdc", projectedMicro: 1n, capMicro: 0n });
  });

  it("counts gross outflow cumulatively and never credits a later return of funds", () => {
    const cap = new SpendCap({ nls: 10_000n, usdc: 0n });
    cap.record([nls(6000n)]);
    expect(cap.spent("nls")).toBe(6000n);
    // A second spend that would breach the cap given what is already spent is refused; there is
    // no API that could credit the first spend back to re-open headroom.
    expect(cap.check([nls(5000n)])).toEqual({
      ok: false,
      overDenom: "nls",
      projectedMicro: 11_000n,
      capMicro: 10_000n
    });
    cap.record([nls(4000n)]);
    expect(cap.spent("nls")).toBe(10_000n);
  });

  it("rejects a negative micro amount", () => {
    const cap = new SpendCap({ nls: 10n, usdc: 0n });
    expect(() => cap.check([nls(-1n)])).toThrow(/non-negative/);
  });
});

describe("SpendCap pending accounting", () => {
  it("reserves before sign and settles on commit, leaving pending at zero", () => {
    const cap = new SpendCap({ nls: 10_000n, usdc: 0n });
    const items = [nls(3000n)];
    cap.reserve(items);
    expect(cap.pending("nls")).toBe(3000n);
    // The projection includes pending: a second candidate sees the reservation.
    expect(cap.check([nls(8000n)])).toEqual({
      ok: false,
      overDenom: "nls",
      projectedMicro: 11_000n,
      capMicro: 10_000n
    });
    cap.settle(items);
    expect(cap.pending("nls")).toBe(0n);
    expect(cap.spent("nls")).toBe(3000n);
  });

  it("releases a reservation on failure without crediting spend", () => {
    const cap = new SpendCap({ nls: 10_000n, usdc: 0n });
    const items = [nls(3000n)];
    cap.reserve(items);
    cap.release(items);
    expect(cap.pending("nls")).toBe(0n);
    expect(cap.spent("nls")).toBe(0n);
  });
});

describe("spendCapFromMicros / snapshot", () => {
  it("builds from micro strings and snapshots caps and spend", () => {
    const cap = spendCapFromMicros("1000000", "0");
    cap.record([nls(250_000n)]);
    expect(cap.snapshot()).toEqual([
      { denom: "nls", capMicro: 1_000_000n, spentMicro: 250_000n },
      { denom: "usdc", capMicro: 0n, spentMicro: 0n }
    ]);
  });
});
