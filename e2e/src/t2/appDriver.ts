import type { Page } from "@playwright/test";
import { Agent } from "undici";
import type { Dispatcher } from "undici";
import { expect } from "./support.js";
import { parseT1Config } from "../config.js";
import { createUndiciConnector } from "../resolver.js";
import { getJson } from "../http.js";

export const APP_SHELL_TIMEOUT = 20000;
export const CONNECT_TIMEOUT = 30000;

const MECHANISM_KEY = "wallet_connect_mechanism";
const EXTENSION_MECHANISM = "extension";
const MESSAGE_PREFIX = "message.";

export interface OriginContext {
  origin: string;
  dispatcher: Dispatcher | undefined;
}

/** Resolve the SPA origin plus a host-resolver-aware undici dispatcher for Node-side reads. */
export function resolveOrigin(): OriginContext {
  const parsed = parseT1Config(process.env);
  if (!parsed.ok) {
    throw new Error(`E2E config error: ${parsed.errors.join("; ")}`);
  }
  const origin = parsed.config.baseUrl.replace(/\/$/, "");
  const dispatcher =
    parsed.config.hostOverrides.size > 0
      ? new Agent({ connect: createUndiciConnector(parsed.config.hostOverrides) })
      : undefined;
  return { origin, dispatcher };
}

/** Fetch the live English locale served by the target (deploy-host copy can drift from the repo). */
export async function fetchLocale(ctx: OriginContext): Promise<unknown> {
  return getJson(`${ctx.origin}/api/locales/en`, ctx.dispatcher);
}

/**
 * Resolve an i18n key (with or without the leading `message.` classifyError uses) to the
 * live English string. Throws loudly if the key is absent so a drifted/renamed key is a
 * red, never a silent empty assertion.
 */
export function messageValue(locale: unknown, key: string): string {
  const bare = key.startsWith(MESSAGE_PREFIX) ? key.slice(MESSAGE_PREFIX.length) : key;
  if (typeof locale !== "object" || locale === null) {
    throw new Error("locale payload is not an object");
  }
  const message = (locale as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) {
    throw new Error("locale payload has no message map");
  }
  const value = (message as Record<string, unknown>)[bare];
  if (typeof value !== "string") {
    throw new Error(`locale message "${bare}" is missing`);
  }
  return value;
}

export function truncateAddress(address: string, front = 8, back = 4): string {
  return `${address.substring(0, front)}...${address.substring(address.length - back)}`;
}

export async function waitForAppShell(page: Page): Promise<void> {
  await page.locator("#app button").first().waitFor({ state: "visible", timeout: APP_SHELL_TIMEOUT });
}

export interface ConnectLabels {
  connect: string;
  keplr: string;
}

export function readConnectLabels(locale: unknown): ConnectLabels {
  return { connect: messageValue(locale, "connect-wallet"), keplr: messageValue(locale, "keplr") };
}

export async function connectKeplr(page: Page, labels: ConnectLabels): Promise<void> {
  await page.getByRole("button", { name: labels.connect, exact: true }).click();
  await page.getByRole("button", { name: labels.keplr, exact: true }).click();
}

/** Assert the app reached the wallet-connected state for `address`. */
export async function assertConnected(page: Page, address: string): Promise<void> {
  const shortName = truncateAddress(address);
  await expect(page.getByRole("button", { name: shortName, exact: true })).toBeVisible({ timeout: CONNECT_TIMEOUT });
  const mechanism = await page.evaluate<string | null>(`localStorage.getItem(${JSON.stringify(MECHANISM_KEY)})`);
  expect(mechanism).toBe(EXTENSION_MECHANISM);
}

/**
 * Connect the scripted wallet, then navigate to a routed form dialog. `connectAt` is where
 * the connect happens (default the home route); a funded wallet should connect on a lighter
 * route (e.g. `/assets`) to avoid the dashboard's heavy analytics/debt fetches, which
 * otherwise multiply the per-test `/api` load and trip the shared rate-limit bucket.
 */
export async function connectThenGoto(
  page: Page,
  labels: ConnectLabels,
  address: string,
  path: string,
  connectAt = "/"
): Promise<void> {
  await page.goto(connectAt, { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await connectKeplr(page, labels);
  await assertConnected(page, address);
  if (path !== connectAt) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}
