import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import type { OriginContext, ConnectLabels } from "./appDriver.js";
import { resolveOrigin, fetchLocale, readConnectLabels, messageValue, connectThenGoto } from "./appDriver.js";
import {
  typeAmount,
  assertFieldError,
  toast,
  requireOrSkip,
  probeNativeMicroBalance,
  allowStagingNoise,
  allowStatus,
  waitForSwapReady,
  waitForFundedFromNls
} from "./matrixHelpers.js";
import { parseMatrixConfig } from "../config.js";

// classifyError seams are reachable only where a POST /api/swap/route fetch actually fires,
// which the Swap form does once a balance-passing amount is entered. The route is DRIVEN
// with the funded secondary wallet (real native balance) and the response is MOCKED to the
// error under test; a bare status still classifies by status. The Send form's route fetch
// only fires on a cross-chain (non-native) network, so classify is scoped to Swap.

interface ClassifyCase {
  name: string;
  status: number;
  body: { error: { code: string; message: string } };
  expectedKey: string;
  expectToast: boolean;
}

const CASES: ClassifyCase[] = [
  {
    name: "429 -> rate-limit-exceeded (inline + toast)",
    status: 429,
    body: { error: { code: "rate_limited", message: "slow down" } },
    expectedKey: "rate-limit-exceeded",
    expectToast: true
  },
  {
    name: "SWAP_ROUTE_FAILED code -> swap-route-failed",
    status: 400,
    body: { error: { code: "SWAP_ROUTE_FAILED", message: "no viable route" } },
    expectedKey: "swap-route-failed",
    expectToast: false
  },
  {
    name: "liquidity message -> no-liquidity",
    status: 400,
    body: { error: { code: "query_failed", message: "insufficient liquidity for this swap" } },
    expectedKey: "no-liquidity",
    expectToast: false
  },
  {
    name: "generic failure -> unexpected-error",
    status: 400,
    body: { error: { code: "boom", message: "something broke" } },
    expectedKey: "unexpected-error",
    expectToast: false
  }
];

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

/** Connect the funded wallet, open Swap, and flip so From is the native (funded) asset. */
async function openFundedSwap(page: Page, address: string): Promise<void> {
  await connectThenGoto(page, labels, address, "/assets/swap", "/assets");
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  await waitForSwapReady(page);
  // Flip so From is the native (funded) asset, then wait for its balance to load.
  await page.locator("#dialog-scroll button.button-secondary").first().click();
  await waitForFundedFromNls(page);
}

test.describe("classifyError seams via the swap route", () => {
  for (const testCase of CASES) {
    test(testCase.name, async ({ page, budget, wallet }, testInfo) => {
      budget.route = "/assets/swap";
      allowStagingNoise(budget);
      budget.allow.consoleErrors.push(/ApiError/);
      allowStatus(budget, "/api/swap/route", testCase.status);

      const micro = await probeNativeMicroBalance(ctx, wallet.address);
      requireOrSkip(
        testInfo,
        expectFunded,
        micro > 0n,
        "connected wallet holds no native balance to drive a swap quote"
      );

      let routeHits = 0;
      await page.route("**/api/swap/route", async (route) => {
        routeHits += 1;
        await route.fulfill({
          status: testCase.status,
          contentType: "application/json",
          body: JSON.stringify(testCase.body)
        });
      });

      await openFundedSwap(page, wallet.address);
      await typeAmount(page, "swap-1", "0.5");

      const expected = messageValue(locale, testCase.expectedKey);
      await assertFieldError(page, expected);
      // A silent path mismatch (route never called) must be a red, not a vacuous green.
      expect(routeHits, "the swap route intercept must have fired").toBeGreaterThan(0);

      if (testCase.expectToast) {
        // Every 429 also fires the global toast (BackendApi.onRateLimited) — the string
        // surfaces twice, never singular.
        await expect(toast(page)).toContainText(expected, { timeout: 10000 });
      }
    });
  }
});
