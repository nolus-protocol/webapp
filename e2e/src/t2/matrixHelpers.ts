import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect } from "./support.js";
import type { BudgetState } from "../t1/support.js";
import type { OriginContext } from "./appDriver.js";
import { getJson } from "../http.js";

export const FIELD_ERROR = "div.text-typography-error";

// Page-shell analytics/governance READ endpoints observed transiently 5xx-ing (or dropping)
// on staging. They load on navigation but are orthogonal to the form/swap behavior these
// specs assert. Scoped by URL so a 5xx on any endpoint a spec actually drives — the swap
// route, a quote, or the balance read a validation depends on — still fails the budget. This
// is a maintained allowlist of documented flaky reads; add a path only after observing it.
const STAGING_FLAKY_PATHS = /\/api\/(etl|governance)\//;

/**
 * Allowlist the transient page-shell read failures orthogonal to the form/swap behavior
 * these specs assert — the app logs the failure and carries on. Failed requests are scoped
 * to the documented flaky paths (so an unrelated 5xx still fails); the browser's
 * `Failed to load resource` / `Failed to fetch` console lines carry no URL, so they are
 * allowed generally but are backstopped by the URL-scoped failedRequests gate above.
 * classify/ratelimit add their own tight per-status allowlist entries on top of this.
 */
export function allowStagingNoise(budget: BudgetState): void {
  budget.allow.failedRequests.push(STAGING_FLAKY_PATHS);
  budget.allow.consoleErrors.push(/Failed to fetch/);
  budget.allow.consoleErrors.push(/Failed to load resource.*status of 5\d\d/);
}

/** Allow the response + browser console-error pair a deliberate mocked HTTP status produces. */
export function allowStatus(budget: BudgetState, urlFragment: string, status: number): void {
  budget.allow.failedRequests.push(new RegExp(`${urlFragment}.*HTTP ${status}`));
  budget.allow.consoleErrors.push(new RegExp(`Failed to load resource.*status of ${status}`));
}

/**
 * Wait until the Swap dialog's balances have loaded (a numeric "Balance:" is shown). The
 * direction flip is a no-op until the currency options and balances are ready, so flipping
 * before this races and leaves From on the unfunded default.
 */
export async function waitForSwapReady(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const text = await page
          .locator("#dialog-scroll")
          .first()
          .innerText()
          .catch(() => "");
        return /Balance:\s*[0-9]/.test(text);
      },
      { message: "swap balances should load before flipping", timeout: 20000, intervals: [500, 1000, 1000, 2000, 2000] }
    )
    .toBe(true);
}

/**
 * The largest `<n> NLS` value currently shown in the Swap dialog — i.e. the rendered NLS
 * token balance on the (flipped) From side. Unlike the assets table, the swap balance is not
 * subject to the small-balance filter, so it reflects even a micro balance.
 */
export async function readSwapFromNls(page: Page): Promise<number> {
  const text = await page
    .locator("#dialog-scroll")
    .first()
    .innerText()
    .catch(() => "");
  const matches = [...text.matchAll(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*NLS/g)].map((m) =>
    Number((m[1] ?? "0").replace(/,/g, ""))
  );
  return matches.length > 0 ? Math.max(...matches) : 0;
}

/**
 * Wait until the Swap "From" side shows a funded native (NLS) balance. Balances load
 * asynchronously after connect, so typing before they arrive would validate against a zero
 * balance and surface "Insufficient balance" instead of exercising the quote path.
 */
export async function waitForFundedFromNls(page: Page): Promise<void> {
  await expect
    .poll(() => readSwapFromNls(page), {
      message: "the swap From side should show a funded NLS balance",
      timeout: 20000,
      intervals: [500, 1000, 1000, 2000, 2000]
    })
    .toBeGreaterThan(0);
}

/**
 * The amount input across every leaf form is an `AdvancedFormControl` input whose value is
 * write-only via its `@input` emit (no `:value` binding) — its parent ref only updates on
 * the component's keyup path, so a bulk `fill()` never emits. `pressSequentially` fires the
 * key events, so the form's reactive validation/quote watch actually runs.
 */
export async function typeAmount(page: Page, inputId: string, value: string): Promise<void> {
  const input = page.locator(`#${inputId}`);
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.click();
  await input.fill("");
  await input.pressSequentially(value, { delay: 60 });
}

/** The animated amount-field error message (`div.text-typography-error > span`). */
export function fieldError(page: Page): Locator {
  return page.locator(FIELD_ERROR).first();
}

/** The global toast body (App.vue renders the message as the toast slot text). */
export function toast(page: Page): Locator {
  return page.locator("div.toast");
}

export async function assertFieldError(page: Page, expected: string): Promise<void> {
  await expect(fieldError(page)).toContainText(expected, { timeout: 15000 });
}

/** Walk a nested `unknown` by string keys and return the leaf only if it is a string. */
export function readString(root: unknown, ...path: string[]): string | undefined {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null || !(key in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Native `unls` micro-balance for an address, read Node-side through the host resolver. */
export async function probeNativeMicroBalance(ctx: OriginContext, address: string): Promise<bigint> {
  const payload = await getJson(`${ctx.origin}/api/balances?address=${address}`, ctx.dispatcher);
  if (typeof payload !== "object" || payload === null) return 0n;
  const balances = (payload as Record<string, unknown>).balances;
  if (!Array.isArray(balances)) return 0n;
  let total = 0n;
  for (const entry of balances) {
    if (readString(entry, "denom") === "unls") {
      const amount = readString(entry, "amount");
      if (amount !== undefined) total += BigInt(amount);
    }
  }
  return total;
}

/**
 * True if the address holds any non-zero balance in a non-native denom. The downpayment/supply
 * currency for a lease or earn form is a fungible token (USDC, an `ibc/...` denom), never the
 * native `unls`, so this is the denom-agnostic signal that a funded wallet can cover such a form —
 * used to skip the empty-balance validation premise when it can no longer hold.
 */
export async function probeHasNonNativeBalance(ctx: OriginContext, address: string): Promise<boolean> {
  const payload = await getJson(`${ctx.origin}/api/balances?address=${address}`, ctx.dispatcher);
  if (typeof payload !== "object" || payload === null) return false;
  const balances = (payload as Record<string, unknown>).balances;
  if (!Array.isArray(balances)) return false;
  for (const entry of balances) {
    const denom = readString(entry, "denom");
    const amount = readString(entry, "amount");
    if (
      denom !== undefined &&
      denom !== "unls" &&
      amount !== undefined &&
      /^\d+$/.test(amount) &&
      BigInt(amount) > 0n
    ) {
      return true;
    }
  }
  return false;
}

/** True if the address holds at least one non-empty entry at the given list path. */
export async function probeHasEntries(ctx: OriginContext, path: string, listKey: string): Promise<boolean> {
  const payload = await getJson(`${ctx.origin}${path}`, ctx.dispatcher);
  if (typeof payload !== "object" || payload === null) return false;
  const list = (payload as Record<string, unknown>)[listKey];
  return Array.isArray(list) && list.length > 0;
}

/**
 * Enforce a funded precondition. Default (local) mode records a machine-readable skip and
 * halts the test; `E2E_EXPECT_FUNDED=1` (CI, funded primary) turns the unmet precondition
 * into a hard failure instead. Every skip is annotated so a run can count skipped cells.
 */
export function requireOrSkip(testInfo: TestInfo, expectFunded: boolean, ok: boolean, reason: string): void {
  if (ok) return;
  testInfo.annotations.push({ type: "matrix-skip", description: reason });
  if (expectFunded) {
    throw new Error(`E2E_EXPECT_FUNDED=1 but precondition unmet: ${reason}`);
  }
  testInfo.skip(true, reason);
}
