import { test, expect } from "./support.js";
import type { WsState } from "./support.js";
import type { Page } from "@playwright/test";

// Every route boots wallet-less; the catch-all redirects unknown paths to "/".
const ROUTES = ["/", "/assets", "/earn", "/positions", "/stake", "/activities", "/vote", "/stats"] as const;

const APP_SHELL_TIMEOUT = 20000;
const WS_ACK_TIMEOUT = 15000;
const WS_OBSERVE_MS = 1500;

async function waitForAppShell(page: Page): Promise<void> {
  // The header renders interactive controls only after the language guard resolves
  // and the SPA mounts, so the first visible button is a stable "interactive" signal
  // across every route and viewport without waiting on networkidle.
  await page.locator("#app button").first().waitFor({ state: "visible", timeout: APP_SHELL_TIMEOUT });
}

function wsObservationStatus(ws: WsState): "closed" | "open-stable" | "waiting" {
  if (ws.closed) return "closed";
  if (Date.now() - ws.openedAt >= WS_OBSERVE_MS) return "open-stable";
  return "waiting";
}

async function assertWsHealthy(ws: WsState): Promise<void> {
  await expect
    .poll(() => ws.sawWsUrl, { message: "a WebSocket to a URL ending /ws should open", timeout: WS_ACK_TIMEOUT })
    .toBe(true);
  await expect
    .poll(() => ws.ackReceived, {
      message: "WS should receive a prices 'subscribed' ack frame",
      timeout: WS_ACK_TIMEOUT
    })
    .toBe(true);
  await expect
    .poll(() => wsObservationStatus(ws), {
      message: "the /ws WebSocket should stay open through the observation window",
      timeout: WS_OBSERVE_MS + 3000
    })
    .toBe("open-stable");
}

for (const route of ROUTES) {
  test(`route ${route} boots wallet-less and clean`, async ({ page, budget }, testInfo) => {
    budget.route = route;
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await waitForAppShell(page);
    if (testInfo.project.name === "desktop-dark") {
      await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
    }
    await assertWsHealthy(budget.ws);
  });
}
