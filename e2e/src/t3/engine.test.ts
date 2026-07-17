import { describe, expect, it } from "vitest";
import { EngineHaltedError, RoleViolationError, TxEngine } from "./engine.js";
import type { EngineOptions } from "./engine.js";
import { SerialQueue } from "./serialQueue.js";
import { SpendCap } from "./spendCap.js";
import type { SpendItem } from "./spendCap.js";

const instant = { now: (): number => 0, sleep: (): Promise<void> => Promise.resolve() };

function options(overrides: Partial<EngineOptions> = {}): EngineOptions {
  return {
    primary: { role: "primary", key: "P", address: "nolus1primary" },
    secondary: { role: "secondary", key: "S", address: "nolus1secondary" },
    workers: 1,
    retries: 0,
    wallet2LowWaterMicro: 5_000_000n,
    ...overrides
  };
}

function engineWith(cap: SpendCap, overrides: Partial<EngineOptions> = {}): TxEngine {
  return new TxEngine({ queue: new SerialQueue(instant), cap }, options(overrides));
}

const nls = (micro: bigint): SpendItem[] => [{ denom: "nls", micro }];

describe("TxEngine construction", () => {
  it("rejects swapped or wrong wallet roles", () => {
    expect(() =>
      engineWith(new SpendCap({ nls: 1n, usdc: 0n }), { primary: { role: "secondary", key: "P", address: "a" } })
    ).toThrow(RoleViolationError);
  });

  it("refuses to run under worker parallelism > 1", () => {
    expect(() => engineWith(new SpendCap({ nls: 1n, usdc: 0n }), { workers: 2 })).toThrow(/serial execution/);
  });

  it("refuses to run when the project configures a non-zero retry count on the spend path", () => {
    expect(() => engineWith(new SpendCap({ nls: 1n, usdc: 0n }), { retries: 1 })).toThrow(/must not retry/);
  });
});

describe("TxEngine spend gate", () => {
  it("aborts before the executor runs when a candidate exceeds cap, and emits nothing value-moving", async () => {
    const engine = engineWith(new SpendCap({ nls: 1000n, usdc: 0n }));
    let ran = false;
    const outcome = await engine.spend({
      walletKey: "P",
      action: "swap",
      items: nls(2000n),
      execute: () => {
        ran = true;
        return Promise.resolve("x");
      }
    });
    expect(ran).toBe(false);
    expect(outcome.status).toBe("spend-cap-abort");
    expect(engine.halted).toBe(true);
  });

  it("refuses every further submission once halted", async () => {
    const engine = engineWith(new SpendCap({ nls: 1000n, usdc: 0n }));
    await engine.spend({ walletKey: "P", action: "swap", items: nls(2000n), execute: () => Promise.resolve(1) });
    await expect(
      engine.spend({ walletKey: "P", action: "swap", items: nls(1n), execute: () => Promise.resolve(1) })
    ).rejects.toThrow(EngineHaltedError);
  });

  it("commits a within-cap spend and records the gross outflow", async () => {
    const cap = new SpendCap({ nls: 10_000n, usdc: 0n });
    const engine = engineWith(cap);
    const outcome = await engine.spend({
      walletKey: "P",
      action: "native-send",
      items: nls(3000n),
      execute: () => Promise.resolve("hash")
    });
    expect(outcome).toEqual({ status: "committed", value: "hash" });
    expect(cap.spent("nls")).toBe(3000n);
    expect(cap.pending("nls")).toBe(0n);
  });

  it("releases the reservation on a failed broadcast without counting spend", async () => {
    const cap = new SpendCap({ nls: 10_000n, usdc: 0n });
    const engine = engineWith(cap);
    await expect(
      engine.spend({
        walletKey: "P",
        action: "native-send",
        items: nls(3000n),
        execute: () => Promise.reject(new Error("boom"))
      })
    ).rejects.toThrow("boom");
    expect(cap.spent("nls")).toBe(0n);
    expect(cap.pending("nls")).toBe(0n);
  });
});

describe("TxEngine wallet roles", () => {
  it("forbids a governed spend from the secondary wallet", async () => {
    const engine = engineWith(new SpendCap({ nls: 10_000n, usdc: 0n }));
    await expect(
      engine.spend({ walletKey: "S", action: "swap", items: nls(1n), execute: () => Promise.resolve(1) })
    ).rejects.toThrow(RoleViolationError);
  });

  it("allows a counterparty dust send from either wallet, still cap-counted", async () => {
    const cap = new SpendCap({ nls: 10_000n, usdc: 0n });
    const engine = engineWith(cap);
    const outcome = await engine.counterpartySend({
      walletKey: "S",
      action: "native-send",
      items: nls(1000n),
      execute: () => Promise.resolve("ok")
    });
    expect(outcome).toEqual({ status: "committed", value: "ok" });
    expect(cap.spent("nls")).toBe(1000n);
  });

  it("rejects a counterparty send from an unknown wallet", async () => {
    const engine = engineWith(new SpendCap({ nls: 10_000n, usdc: 0n }));
    await expect(
      engine.counterpartySend({
        walletKey: "Z",
        action: "native-send",
        items: nls(1n),
        execute: () => Promise.resolve(1)
      })
    ).rejects.toThrow(RoleViolationError);
  });
});

describe("TxEngine reporting", () => {
  it("warns only when wallet-2 balance is below the floor", () => {
    const engine = engineWith(new SpendCap({ nls: 1n, usdc: 0n }));
    expect(engine.lowBalanceWarning(6_000_000n)).toBeNull();
    expect(engine.lowBalanceWarning(4_000_000n)).toContain("low-water");
  });

  it("builds a leftover report carrying the spend snapshot and an explicit abort", () => {
    const cap = new SpendCap({ nls: 1_000n, usdc: 0n });
    const engine = engineWith(cap);
    engine.abort("manual");
    const report = engine.buildReport({
      generatedAt: "t",
      terminal: "app-failure",
      journal: [],
      openLeases: [],
      pendingUnbondings: [],
      warnings: ["w"]
    });
    expect(report.terminal).toBe("app-failure");
    expect(report.spend).toEqual([
      { denom: "nls", capMicro: "1000", spentMicro: "0" },
      { denom: "usdc", capMicro: "0", spentMicro: "0" }
    ]);
    expect(engine.reason).toBe("manual");
  });
});
