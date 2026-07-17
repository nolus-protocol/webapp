/**
 * Phase 5 fault injection at the network boundary (fixture mode). Each case overrides one
 * intercepted route/socket with a fault and asserts the real per-endpoint behavior — the
 * boot-critical endpoints white-screen (`entry-client` replaces `#app` with a hardcoded
 * English failure card), governance returns 200+empty on a cold cache (never 503), a
 * post-boot analytics fault degrades one page without white-screening, and a WS hang or a
 * garbage frame is handled gracefully. `page.route`/`routeWebSocket` added in the test win
 * over the fixture-mode defaults (last handler wins).
 *
 * Assertion labels (coverage matrix): `fault-boot-config-whitescreen`,
 * `fault-premount-networks-whitescreen`, `fault-governance-cold-empty`,
 * `fault-postboot-degraded`, `fault-postboot-malformed`, `fault-ws-hang-graceful`,
 * `fault-ws-garbage-graceful`.
 */

import { test, expect } from "../fixtures/support.js";
import type { Page, Route } from "@playwright/test";

const WHITE_SCREEN = "Failed to load application";
const SHELL_TIMEOUT = 20000;

async function fulfillStatus(page: Page, glob: string, status: number): Promise<void> {
  await page.route(glob, (route: Route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "injected" }) })
  );
}

async function expectWhiteScreen(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toContainText(WHITE_SCREEN, { timeout: SHELL_TIMEOUT });
}

async function expectInteractive(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("#app button").first().waitFor({ state: "visible", timeout: SHELL_TIMEOUT });
  await expect(page.locator("#app")).not.toContainText(WHITE_SCREEN);
}

test("fault-boot-config-whitescreen: a 503 on a boot-critical endpoint white-screens", async ({
  page,
  fixtureMode
}) => {
  void fixtureMode;
  await fulfillStatus(page, "**/api/config", 503);
  await expectWhiteScreen(page, "/assets");
});

test("fault-premount-networks-whitescreen: gated-networks 503 fails pre-mount", async ({ page, fixtureMode }) => {
  void fixtureMode;
  await fulfillStatus(page, "**/api/networks/gated", 503);
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#app")).toContainText(WHITE_SCREEN, { timeout: SHELL_TIMEOUT });
  // Distinct from the config case: Vue never mounted, so no interactive control ever appears.
  expect(await page.locator("#app button").count()).toBe(0);
});

test("fault-governance-cold-empty: cold governance returns 200+empty, never 503", async ({ page, fixtureMode }) => {
  void fixtureMode;
  await page.route("**/api/governance/proposals**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Status": "cold" },
      body: JSON.stringify({ proposals: [], pagination: { total: "0" } })
    })
  );
  // The empty cold cache renders an empty state without white-screening or crashing.
  await expectInteractive(page, "/vote");
});

test("fault-postboot-degraded: a 503 on a post-boot analytics read degrades one page", async ({
  page,
  fixtureMode
}) => {
  void fixtureMode;
  await fulfillStatus(page, "**/api/etl/batch/stats-overview", 503);
  await expectInteractive(page, "/stats");
});

test("fault-postboot-malformed: a malformed post-boot body does not crash the page", async ({ page, fixtureMode }) => {
  void fixtureMode;
  await page.route("**/api/etl/batch/stats-overview", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{not-json" })
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await expectInteractive(page, "/stats");
  expect(pageErrors, `uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});

test("fault-ws-hang-graceful: a WS that opens but never acks still boots", async ({ page, fixtureMode }) => {
  void fixtureMode;
  // Accept the socket but never answer the subscribe. connect() resolves on OPEN, not the
  // ack, so boot completes; the page must not white-screen.
  await page.routeWebSocket(/\/ws$/, () => {
    /* accept and hang */
  });
  await expectInteractive(page, "/assets");
});

test("fault-ws-garbage-graceful: a garbage WS frame is caught, no crash", async ({ page, fixtureMode }) => {
  void fixtureMode;
  await page.routeWebSocket(/\/ws$/, (ws) => {
    ws.onMessage(() => {
      ws.send("this-is-not-json{{");
    });
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await expectInteractive(page, "/assets");
  expect(pageErrors, `uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});
