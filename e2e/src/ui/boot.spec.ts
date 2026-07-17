import { test, expect } from "../fixtures/support.js";

// Every wallet-less route must reach an interactive shell in fixture mode. If the WS stub
// or the intercepted boot-critical HTTP set is wrong, the app white-screens and this fails
// before any downstream fixture-mode spec can produce a misleading green.
const ROUTES = ["/", "/assets", "/earn", "/positions", "/stake", "/activities", "/vote", "/stats"] as const;

for (const route of ROUTES) {
  test(`fixture-mode boots ${route} to interactive`, async ({ page, fixtureMode }) => {
    await fixtureMode.boot(page, route);
    await expect(page.locator("#app button").first()).toBeVisible();
  });
}
