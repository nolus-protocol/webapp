/**
 * Phase 3 (fixture side): the math bridge against deterministic fixture data. The /stats
 * overview figures are recomputed with the independent oracle and asserted against the
 * rendered AnimateNumber aria-label. Because the fixture is deterministic, the mutation
 * test genuinely bites: a ×2 mutation of the served payload moves the render to match the
 * oracle on the mutated value and away from the original.
 *
 * Assertion labels (coverage matrix): `bridge-stats-tvl`, `bridge-stats-txvolume`,
 * `bridge-stats-realizedpnl`, `bridge-assets-zero`, `bridge-stats-mutation-bites`.
 */

import { test, expect } from "../fixtures/support.js";
import type { Route } from "@playwright/test";
import { animatedCompact } from "../oracle/index.js";
import { readFixture } from "../fixtures/loader.js";
import { figureContainer, fixtureLabel, readStableAria } from "./figures.js";

const STATS_FIXTURE = "common/etl-batch-stats-overview.json";

interface StatsOverview {
  tvl: { total_value_locked: string };
  tx_volume: { total_tx_value: string };
  realized_pnl_stats: { amount: string };
}

function statsFixture(): StatsOverview {
  return readFixture(STATS_FIXTURE) as StatsOverview;
}

test.describe("fixture-mode math bridge — /stats overview", () => {
  const figures: { id: string; label: string; value: (s: StatsOverview) => string }[] = [
    { id: "bridge-stats-tvl", label: "tvl", value: (s) => s.tvl.total_value_locked },
    { id: "bridge-stats-txvolume", label: "tx-volume", value: (s) => s.tx_volume.total_tx_value },
    { id: "bridge-stats-realizedpnl", label: "realized-pnl", value: (s) => s.realized_pnl_stats.amount }
  ];

  for (const figure of figures) {
    test(`${figure.id}: rendered equals oracle-recomputed compact`, async ({ page, fixtureMode }) => {
      // coverage: bridge-stats-tvl | bridge-stats-txvolume | bridge-stats-realizedpnl
      await fixtureMode.boot(page, "/stats");
      const container = figureContainer(page, fixtureLabel(figure.label));
      await expect(container).toBeVisible();
      await expect(container).toContainText("$");
      expect(await readStableAria(container)).toBe(animatedCompact(figure.value(statsFixture())));
    });
  }

  test("bridge-stats-mutation-bites: a ×2 payload mutation moves the render", async ({ page, fixtureMode }) => {
    const original = statsFixture();
    const mutated: StatsOverview = structuredClone(original);
    mutated.tvl.total_value_locked = (Number(original.tvl.total_value_locked) * 2).toString();
    // Override just the stats-overview route with the mutated body (installed before boot).
    await page.route("**/api/etl/batch/stats-overview", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mutated) })
    );

    await fixtureMode.boot(page, "/stats");
    const rendered = await readStableAria(figureContainer(page, fixtureLabel("tvl")));
    expect(rendered).toBe(animatedCompact(mutated.tvl.total_value_locked));
    expect(rendered).not.toBe(animatedCompact(original.tvl.total_value_locked));
  });
});

test("bridge-assets-zero: wallet-less assets total renders the formatted zero", async ({ page, fixtureMode }) => {
  await fixtureMode.boot(page, "/assets");
  const container = figureContainer(page, fixtureLabel("assets-title"));
  await expect(container).toBeVisible();
  await expect(container).toContainText("$");
  expect(await readStableAria(container)).toBe("0.00");
});
