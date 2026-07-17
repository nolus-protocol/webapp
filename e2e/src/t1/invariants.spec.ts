/**
 * Phase 4 cross-field invariants on live data (wallet-less, runnable). Asserts relational
 * truths, not golden numbers. The funded invariants (dashboard total == assets total, table
 * total == sum of rendered rows on a funded wallet, lease PnL sign, long liq < spot < short
 * liq) are funded-gated and recorded in the coverage matrix; the oracle unit vectors cover
 * their math. These two are verifiable without a wallet.
 *
 * Assertion label: `invariant-tvl-cross-endpoint`.
 */

import { test, expect } from "./support.js";
import { Agent } from "undici";
import type { Dispatcher } from "undici";
import { getJson } from "../http.js";
import { parseT1Config } from "../config.js";
import { createUndiciConnector } from "../resolver.js";

let dispatcher: Dispatcher | undefined;
let origin: string;

function readNumber(root: unknown, ...path: string[]): number | undefined {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null || !(key in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" || typeof cur === "number" ? Number(cur) : undefined;
}

test.beforeAll(() => {
  const parsed = parseT1Config(process.env);
  if (!parsed.ok) throw new Error(`T1 config error: ${parsed.errors.join("; ")}`);
  origin = parsed.config.baseUrl.replace(/\/$/, "");
  dispatcher =
    parsed.config.hostOverrides.size > 0
      ? new Agent({ connect: createUndiciConnector(parsed.config.hostOverrides) })
      : undefined;
});

test.afterAll(async () => {
  if (dispatcher !== undefined) await dispatcher.close();
});

// Total value locked is a single protocol quantity surfaced by two endpoints (the /stats
// overview and the /earn stats). They must agree — a divergence means one view is stale or
// computed differently, a real cross-field bug this relation catches without a golden value.
test("invariant-tvl-cross-endpoint: /stats TVL equals /earn TVL", async ({ budget }) => {
  budget.route = "invariants:tvl";
  const overview = await getJson(`${origin}/api/etl/batch/stats-overview`, dispatcher);
  const earn = await getJson(`${origin}/api/earn/stats`, dispatcher);
  const statsTvl = readNumber(overview, "tvl", "total_value_locked");
  const earnTvl = readNumber(earn, "total_value_locked");
  expect(statsTvl, "stats overview TVL should be present").toBeGreaterThan(0);
  expect(earnTvl, "earn stats TVL should be present").toBeGreaterThan(0);
  // Both derive from the same source; allow a sub-cent relative drift for a price tick
  // straddling the two reads.
  const relativeDrift = Math.abs((statsTvl ?? 0) - (earnTvl ?? 0)) / (statsTvl ?? 1);
  expect(relativeDrift, `TVL drift ${relativeDrift.toString()} between /stats and /earn`).toBeLessThan(0.001);
});
