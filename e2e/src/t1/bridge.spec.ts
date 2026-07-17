import { test, expect } from "./support.js";
import type { Locator, Page } from "@playwright/test";
import { Agent } from "undici";
import type { Dispatcher } from "undici";
import { getJson } from "../http.js";
import { parseT1Config } from "../config.js";
import { createUndiciConnector } from "../resolver.js";
import { animatedCompact } from "../oracle/index.js";

const APP_SHELL_TIMEOUT = 20000;
const STABLE_TIMEOUT = 15000;
const BRIDGE_TIMEOUT = 30000;
const TOLERANCE = 0.01;
const OVERVIEW_PATH = "/api/etl/batch/stats-overview";

// The rendered AnimateNumber exposes the formatted number (no currency symbol) via
// aria-label; the "$" is a separate static prefix asserted independently. The expected
// compact string comes from the independent oracle (`animatedCompact`), not a second
// hand-mirrored copy of the app's format options — one source of formatting truth.
const MULTIPLIERS: Record<string, number> = { "": 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

let dispatcher: Dispatcher | undefined;
let origin: string;
let labels: { tvl: string; txVolume: string; realizedPnl: string; assetsTitle: string };

function readString(root: unknown, ...path: string[]): string | undefined {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null || !(key in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : undefined;
}

function mustString(root: unknown, ...path: string[]): string {
  const value = readString(root, ...path);
  if (value === undefined) throw new Error(`missing string at ${path.join(".")}`);
  return value;
}

function expectedCompact(raw: string): string {
  return animatedCompact(raw);
}

function parseCompact(rendered: string): number | null {
  const match = /^([0-9][0-9,]*(?:\.[0-9]+)?)([KMBT]?)$/.exec(rendered.trim());
  if (match === null) return null;
  const digits = match[1];
  if (digits === undefined) return null;
  const mult = MULTIPLIERS[match[2] ?? ""] ?? 1;
  return Number(digits.replace(/,/g, "")) * mult;
}

function figureContainer(page: Page, label: string): Locator {
  return page.locator("div.label", { hasText: label }).locator("xpath=..").locator("div.items-center.gap-2").first();
}

async function readStableAria(container: Locator): Promise<string> {
  const holder = container.locator("[aria-label]").first();
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = ((await holder.getAttribute("aria-label")) ?? "").replace(/\s+/g, "");
        const stable = current.length > 0 && current === previous;
        previous = current;
        return stable;
      },
      { message: "the AnimateNumber aria-label should stabilize across two reads", timeout: STABLE_TIMEOUT }
    )
    .toBe(true);
  return previous;
}

async function compareFigure(container: Locator, apiPath: readonly string[]): Promise<string> {
  const raw = readString(await getJson(`${origin}${OVERVIEW_PATH}`, dispatcher), ...apiPath);
  if (raw === undefined) return `api-missing:${apiPath.join(".")}`;
  const expected = expectedCompact(raw);
  const rendered = await readStableAria(container);
  if (rendered === expected) return "match-exact";
  const renderedNum = parseCompact(rendered);
  const actual = Math.abs(Number(raw));
  if (renderedNum !== null && actual !== 0 && Math.abs(renderedNum - actual) / actual <= TOLERANCE) {
    return "match-tolerance";
  }
  return `mismatch rendered=${rendered} expected=${expected}`;
}

async function bridgeFigure(page: Page, label: string, apiPath: readonly string[]): Promise<void> {
  const container = figureContainer(page, label);
  await expect(container, `figure "${label}" should be visible`).toBeVisible({ timeout: APP_SHELL_TIMEOUT });
  await expect(container, `figure "${label}" should carry the "$" currency prefix`).toContainText("$");
  await expect
    .poll(() => compareFigure(container, apiPath), {
      message: `stats bridge for "${label}"`,
      timeout: BRIDGE_TIMEOUT,
      intervals: [500, 1000, 1000, 2000]
    })
    .toMatch(/^match/);
}

async function waitForAppShell(page: Page): Promise<void> {
  await page.locator("#app button").first().waitFor({ state: "visible", timeout: APP_SHELL_TIMEOUT });
}

test.beforeAll(async () => {
  const parsed = parseT1Config(process.env);
  if (!parsed.ok) throw new Error(`T1 config error: ${parsed.errors.join("; ")}`);
  origin = parsed.config.baseUrl.replace(/\/$/, "");
  dispatcher =
    parsed.config.hostOverrides.size > 0
      ? new Agent({ connect: createUndiciConnector(parsed.config.hostOverrides) })
      : undefined;
  const locale = await getJson(`${origin}/api/locales/en`, dispatcher);
  labels = {
    tvl: mustString(locale, "message", "tvl"),
    txVolume: mustString(locale, "message", "tx-volume"),
    realizedPnl: mustString(locale, "message", "realized-pnl"),
    assetsTitle: mustString(locale, "message", "assets-title")
  };
});

test.afterAll(async () => {
  if (dispatcher !== undefined) await dispatcher.close();
});

test("stats overview figures bridge math to the rendered values", async ({ page, budget }) => {
  budget.route = "/stats";
  await page.goto("/stats", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await bridgeFigure(page, labels.tvl, ["tvl", "total_value_locked"]);
  await bridgeFigure(page, labels.txVolume, ["tx_volume", "total_tx_value"]);
  await bridgeFigure(page, labels.realizedPnl, ["realized_pnl_stats", "amount"]);
});

test("assets wallet-less total renders the formatted zero value", async ({ page, budget }) => {
  budget.route = "/assets";
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  const container = figureContainer(page, labels.assetsTitle);
  await expect(container, "assets total should be visible").toBeVisible({ timeout: APP_SHELL_TIMEOUT });
  await expect(container, 'assets total should carry the "$" currency prefix').toContainText("$");
  expect(await readStableAria(container)).toBe("0.00");
});
