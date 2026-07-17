import { describe, expect, it } from "vitest";
import { sweep } from "./reconcile.js";
import type { SweepDeps, SweepOptions } from "./reconcile.js";

const NOW = Date.parse("2026-07-17T12:00:00.000Z");
const OLD = "2026-07-17T10:00:00.000Z";
const RECENT = "2026-07-17T11:59:00.000Z";

function depsFrom(leases: unknown, staking: unknown): { deps: SweepDeps; state: { fetches: number } } {
  const state = { fetches: 0 };
  const deps: SweepDeps = {
    now: () => NOW,
    fetchJson: (url: string) => {
      state.fetches += 1;
      return Promise.resolve(url.includes("/api/leases") ? leases : staking);
    }
  };
  return { deps, state };
}

function options(extra: Partial<SweepOptions> = {}): SweepOptions {
  return { origin: "https://app", address: "nolus1owner", attempts: new Map(), ...extra };
}

describe("sweep lease classification", () => {
  it("queues an old opened lease for repair and reads both enumeration endpoints", async () => {
    const { deps, state } = depsFrom(
      { leases: [{ address: "nolus1a", protocol: "OSMOSIS", status: "opened", opened_at: OLD }] },
      {}
    );
    const result = await sweep(deps, options());
    expect(result.queuedForRepair).toEqual([{ address: "nolus1a", protocol: "OSMOSIS", openedAt: OLD, attempt: 0 }]);
    expect(result.nextAttempts.get("nolus1a")).toBe(1);
    expect(result.openLeases).toEqual([{ address: "nolus1a", protocol: "OSMOSIS", status: "opened" }]);
    expect(state.fetches).toBe(2);
  });

  it("demotes an orphan to report-only once attempts are exhausted", async () => {
    const { deps } = depsFrom(
      { leases: [{ address: "nolus1a", protocol: "OSMOSIS", status: "opened", opened_at: OLD }] },
      {}
    );
    const result = await sweep(deps, options({ attempts: new Map([["nolus1a", 3]]), maxAttempts: 3 }));
    expect(result.queuedForRepair).toEqual([]);
    expect(result.reportOnly.map((c) => c.address)).toEqual(["nolus1a"]);
    expect(result.nextAttempts.get("nolus1a")).toBe(3);
  });

  it("tolerates a recently-opened lease and every non-opened status without repairing", async () => {
    const { deps } = depsFrom(
      {
        leases: [
          { address: "nolus1fresh", protocol: "OSMOSIS", status: "opened", opened_at: RECENT },
          { address: "nolus1closing", protocol: "OSMOSIS", status: "closing" },
          { address: "nolus1paid", protocol: "OSMOSIS", status: "paid_off" }
        ]
      },
      {}
    );
    const result = await sweep(deps, options());
    expect(result.queuedForRepair).toEqual([]);
    expect(result.tolerated.map((t) => t.status).sort()).toEqual(["closing", "opened", "paid_off"]);
  });
});

describe("sweep unbondings and partial data", () => {
  it("recognizes pending unbondings and never queues them for repair", async () => {
    const staking = {
      delegations: [],
      unbonding: [{ validator_address: "nolusvaloper1", entries: [{ balance: "1000" }, { balance: "500" }] }]
    };
    const { deps } = depsFrom({ leases: [] }, staking);
    const result = await sweep(deps, options());
    expect(result.pendingUnbondings).toEqual([{ validatorAddress: "nolusvaloper1", entries: 2, balanceMicro: "1500" }]);
    expect(result.queuedForRepair).toEqual([]);
  });

  it("handles a partial-empty staking response (missing arrays) as empty", async () => {
    const { deps } = depsFrom({ leases: [] }, { rewards: [] });
    const result = await sweep(deps, options());
    expect(result.pendingUnbondings).toEqual([]);
    expect(result.openLeases).toEqual([]);
  });

  it("handles a leases payload with no leases array as empty", async () => {
    const { deps } = depsFrom({}, {});
    const result = await sweep(deps, options());
    expect(result.openLeases).toEqual([]);
    expect(result.tolerated).toEqual([]);
  });
});
