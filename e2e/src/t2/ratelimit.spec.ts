import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import { request } from "undici";
import type { OriginContext, ConnectLabels } from "./appDriver.js";
import { resolveOrigin, fetchLocale, readConnectLabels, messageValue, connectThenGoto } from "./appDriver.js";
import {
  toast,
  fieldError,
  requireOrSkip,
  probeNativeMicroBalance,
  allowStagingNoise,
  allowStatus,
  waitForSwapReady,
  waitForFundedFromNls
} from "./matrixHelpers.js";
import { parseMatrixConfig } from "../config.js";

// The strict rate-limit bucket (2rps/burst5, refills in ~2.5s) is keyed per client IP and
// shared between the browser and this Node process (both egress from the same host via the
// resolver). We SATURATE it from Node while the app makes its own real /api/swap/route
// quote, so the app receives a genuine 429 — surfaced inline (classifyError) AND as the
// global toast (BackendApi.onRateLimited). No response is mocked; the 429 is real.

const BURST_WIDTH = 20;
const SATURATE_MAX_MS = 50000;
const NUDGES = ["0.5", "0.6", "0.7"];

test.use({ walletIdentity: "secondary" });

let ctx: OriginContext;
let locale: unknown;
let labels: ConnectLabels;
let expectFunded: boolean;

test.beforeAll(async () => {
  ctx = resolveOrigin();
  locale = await fetchLocale(ctx);
  labels = readConnectLabels(locale);
  const matrix = parseMatrixConfig(process.env);
  if (!matrix.ok) throw new Error(`matrix config error: ${matrix.errors.join("; ")}`);
  expectFunded = matrix.config.expectFunded;
});

test.afterAll(async () => {
  if (ctx.dispatcher !== undefined) await ctx.dispatcher.close();
});

async function hitStrict(): Promise<void> {
  const res = await request(`${ctx.origin}/api/swap/route`, {
    method: "POST",
    ...(ctx.dispatcher ? { dispatcher: ctx.dispatcher } : {}),
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ probe: true })
  });
  await res.body.text();
}

async function saturate(stop: { done: boolean }): Promise<void> {
  // Keep the shared strict bucket empty for the whole poll window (or until stopped) so
  // every app quote that arrives hits an empty bucket — burst-count bounding would let the
  // bucket refill mid-poll and the app request could slip through with a 200.
  const deadline = Date.now() + SATURATE_MAX_MS;
  while (!stop.done && Date.now() < deadline) {
    await Promise.all(Array.from({ length: BURST_WIDTH }, () => hitStrict().catch(() => undefined)));
  }
}

async function openFundedSwap(page: Page, address: string): Promise<void> {
  await connectThenGoto(page, labels, address, "/assets/swap", "/assets");
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  await waitForSwapReady(page);
  await page.locator("#dialog-scroll button.button-secondary").first().click();
  await waitForFundedFromNls(page);
}

test("a real 429 surfaces inline and as a toast without crashing", async ({ page, budget, wallet }, testInfo) => {
  budget.route = "/assets/swap";
  allowStagingNoise(budget);
  budget.allow.consoleErrors.push(/ApiError/);
  allowStatus(budget, "/api/swap/route", 429);

  const micro = await probeNativeMicroBalance(ctx, wallet.address);
  requireOrSkip(testInfo, expectFunded, micro > 0n, "connected wallet holds no native balance to drive a swap quote");

  await openFundedSwap(page, wallet.address);

  const rateMsg = messageValue(locale, "rate-limit-exceeded");
  const stop = { done: false };
  const saturation = saturate(stop);

  try {
    let nudge = 0;
    await expect
      .poll(
        async () => {
          const input = page.locator("#swap-1");
          const value = NUDGES[nudge % NUDGES.length] ?? "0.5";
          nudge += 1;
          await input.fill("").catch(() => undefined);
          await input.pressSequentially(value, { delay: 20 }).catch(() => undefined);
          const inline = await fieldError(page)
            .innerText()
            .catch(() => "");
          const toastText = await toast(page)
            .innerText()
            .catch(() => "");
          return inline.includes(rateMsg) && toastText.includes(rateMsg);
        },
        {
          message: "a real 429 should surface inline AND as a toast",
          timeout: 45000,
          intervals: [800, 800, 800, 800, 800, 800]
        }
      )
      .toBe(true);
  } finally {
    stop.done = true;
    await saturation;
  }

  await expect(fieldError(page)).toContainText(rateMsg);
  await expect(toast(page)).toContainText(rateMsg);
  expect(page.isClosed(), "the page must not crash under rate limiting").toBe(false);
});
