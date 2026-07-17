/**
 * Fixture-mode Playwright support: serves the committed fixture set over intercepted HTTP
 * and stubs the `/ws` socket, so a spec renders deterministic data with no live backend.
 *
 * Why the WS stub is mandatory (verified boot seam): the app awaits
 * `WebSocketClient.connect()` before config, and `connect()` rejects on an error while
 * connecting. A fixture-mode page with only HTTP intercepted has no WS server, so the app
 * would white-screen (`entry-client` replaces `#app` with a hardcoded English failure
 * card). The stub accepts the connection and answers each `subscribe` with the matching
 * `subscribed` ack the app expects, so boot completes.
 *
 * Browser glue — excluded from coverage like the other spec/support modules.
 */

import { test as base, expect } from "@playwright/test";
import type { Page, Route, WebSocketRoute } from "@playwright/test";
import { fixtureForPath, readFixture } from "./loader.js";

const WHITE_SCREEN_TEXT = "Failed to load application";
const APP_SHELL_TIMEOUT = 20000;

export interface FixtureModeController {
  /** Request pathnames with no mapped fixture (a benign `{}` was served). */
  readonly gaps: Set<string>;
  /** Navigate to a route and assert the shell reached interactive (not the white-screen). */
  boot(page: Page, path: string): Promise<void>;
}

export interface FixtureModeOptions {
  themeData: "light" | "dark";
}

export interface FixtureModeFixtures {
  fixtureMode: FixtureModeController;
}

function subscribeTopic(message: string | Buffer): string | undefined {
  const text = typeof message === "string" ? message : message.toString("utf8");
  try {
    const parsed = JSON.parse(text) as { type?: unknown; topic?: unknown };
    if (parsed.type === "subscribe" && typeof parsed.topic === "string") {
      return parsed.topic;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Accept the socket and ack every subscribe; the app needs the prices ack to finish boot. */
function stubWebSocket(ws: WebSocketRoute): void {
  ws.onMessage((message) => {
    const topic = subscribeTopic(message);
    if (topic !== undefined) {
      ws.send(JSON.stringify({ type: "subscribed", topic }));
    }
  });
}

function serveFixture(route: Route, gaps: Set<string>): Promise<void> {
  const pathname = new URL(route.request().url()).pathname;
  const entry = fixtureForPath(pathname);
  if (entry === undefined) {
    gaps.add(pathname);
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(readFixture(entry.file))
  });
}

async function installFixtureMode(page: Page, theme: string, gaps: Set<string>): Promise<void> {
  await page.addInitScript(
    `try { localStorage.setItem('theme_data', ${JSON.stringify(theme)}); localStorage.setItem('language', 'en'); } catch (e) { void e; }`
  );
  await page.routeWebSocket(/\/ws$/, stubWebSocket);
  await page.route("**/api/**", (route) => serveFixture(route, gaps));
}

/** The boot smoke-gate: a fixture-mode spec must clear this before any other assertion. */
async function bootToInteractive(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("#app button").first().waitFor({ state: "visible", timeout: APP_SHELL_TIMEOUT });
  await expect(page.locator("#app"), `fixture-mode boot white-screened on ${path}`).not.toContainText(
    WHITE_SCREEN_TEXT
  );
}

export const test = base.extend<FixtureModeOptions & FixtureModeFixtures>({
  themeData: ["light", { option: true }],
  fixtureMode: async ({ page, themeData }, use) => {
    const gaps = new Set<string>();
    await installFixtureMode(page, themeData, gaps);
    await use({
      gaps,
      boot: (target, path) => bootToInteractive(target, path)
    });
  }
});

export { expect };
