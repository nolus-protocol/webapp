import { describe, it, expect } from "vitest";
import { fixtureForPath, loadAllFixtures, readFixture } from "./loader.js";
import { FIXTURE_ROUTES } from "./registry.js";

describe("fixture path resolution", () => {
  const cases: [string, string][] = [
    ["/api/prices", "prices"],
    ["/api/config", "config"],
    ["/api/fees/gas-config", "gas-config"],
    ["/api/networks/gated", "networks-gated"],
    ["/api/networks/OSMOSIS/assets", "network-assets"],
    ["/api/protocols/OSMOSIS-OSMOSIS-OSMO/currencies", "protocol-currencies-osmo"],
    ["/api/protocols/OSMOSIS-OSMOSIS-NEUTRON/currencies", "protocol-currencies-fallback"],
    ["/api/etl/batch/stats-overview", "stats-overview"],
    ["/api/governance/proposals", "proposals"],
    ["/api/balances", "balances"],
    ["/api/leases", "leases"],
    ["/api/leases/nolus1leaseaddr", "single-lease"],
    ["/api/earn/positions", "earn-positions"]
  ];

  for (const [pathname, expectedId] of cases) {
    it(`resolves ${pathname} to "${expectedId}"`, () => {
      expect(fixtureForPath(pathname)?.id).toBe(expectedId);
    });
  }

  it("returns undefined for an unmapped path", () => {
    expect(fixtureForPath("/api/unknown/endpoint")).toBeUndefined();
  });

  it("single-lease is matched before the leases list (order matters)", () => {
    const single = FIXTURE_ROUTES.findIndex((route) => route.id === "single-lease");
    const list = FIXTURE_ROUTES.findIndex((route) => route.id === "leases");
    expect(single).toBeLessThan(list);
  });
});

describe("fixture files", () => {
  it("every registered fixture file parses as JSON", () => {
    for (const { route, body } of loadAllFixtures()) {
      expect(body, `${route.file} did not parse`).toBeDefined();
    }
  });

  it("every route id is unique", () => {
    const ids = FIXTURE_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("readFixture round-trips a known body", () => {
    const prices = readFixture("common/prices.json") as { prices: Record<string, unknown> };
    expect(Object.keys(prices.prices).length).toBeGreaterThan(0);
  });
});
