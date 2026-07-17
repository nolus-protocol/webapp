import { test, expect } from "./support.js";
import type { OriginContext, ConnectLabels } from "./appDriver.js";
import {
  resolveOrigin,
  fetchLocale,
  readConnectLabels,
  messageValue,
  connectThenGoto,
  CONNECT_TIMEOUT
} from "./appDriver.js";
import {
  typeAmount,
  assertFieldError,
  fieldError,
  requireOrSkip,
  probeNativeMicroBalance,
  probeHasNonNativeBalance,
  probeHasEntries,
  allowStagingNoise
} from "./matrixHelpers.js";
import { parseMatrixConfig } from "../config.js";

/**
 * The empty-balance premise each insufficient-balance cell rests on: a spend form is `native`
 * (delegate spends NLS) or `spend-token` (a lease downpayment / earn supply spends a fungible
 * token), an over-position form is `earn-position` / `stake-position` (withdraw / undelegate over
 * a held position). Under a funded wallet the premise can no longer hold, so the cell skips.
 */
type BalancePremise = "native" | "spend-token" | "earn-position" | "stake-position";

interface FormCell {
  name: string;
  path: string;
  inputId: string;
  submitKey: string;
  premise: BalancePremise;
}

const INSUFFICIENT_CELLS: FormCell[] = [
  {
    name: "lease long",
    path: "/positions/open/long",
    inputId: "receive-send",
    submitKey: "open-position",
    premise: "spend-token"
  },
  {
    name: "lease short",
    path: "/positions/open/short",
    inputId: "receive-send",
    submitKey: "open-position",
    premise: "spend-token"
  },
  { name: "earn supply", path: "/earn/supply", inputId: "receive-send", submitKey: "supply", premise: "spend-token" },
  {
    name: "earn withdraw",
    path: "/earn/withdraw",
    inputId: "receive-send",
    submitKey: "withdraw",
    premise: "earn-position"
  },
  {
    name: "stake delegate",
    path: "/stake/delegate",
    inputId: "receive-send",
    submitKey: "delegate",
    premise: "native"
  },
  {
    name: "stake undelegate",
    path: "/stake/undelegate",
    inputId: "receive-send",
    submitKey: "undelegate",
    premise: "stake-position"
  }
];

const STAKE_CELLS = new Set(["stake delegate", "stake undelegate"]);

/**
 * Whether the cell's empty-balance premise still holds for the connected wallet — i.e. the
 * relevant balance/position is empty and the "Insufficient balance" path is genuinely reachable.
 * A funded wallet returns false, and the cell skips (an unfunded-premise cell, distinct from a
 * funded-gated one — E2E_EXPECT_FUNDED never turns this skip into a failure).
 */
async function emptyBalancePremiseHolds(cell: FormCell, ctx: OriginContext, address: string): Promise<boolean> {
  switch (cell.premise) {
    case "native":
      return (await probeNativeMicroBalance(ctx, address)) === 0n;
    case "spend-token":
      return !(await probeHasNonNativeBalance(ctx, address));
    case "earn-position":
      return !(await probeHasEntries(ctx, `/api/earn/positions?address=${address}`, "positions"));
    case "stake-position":
      return !(await probeHasEntries(ctx, `/api/staking/positions?address=${address}`, "positions"));
    default: {
      const unreachable: never = cell.premise;
      throw new Error(`unhandled balance premise: ${String(unreachable)}`);
    }
  }
}

let ctx: OriginContext;
let locale: unknown;
let labels: ConnectLabels;
let insufficientBalance: string;
let expectFunded: boolean;

test.beforeAll(async () => {
  ctx = resolveOrigin();
  locale = await fetchLocale(ctx);
  labels = readConnectLabels(locale);
  insufficientBalance = messageValue(locale, "invalid-balance-big");
  const matrix = parseMatrixConfig(process.env);
  if (!matrix.ok) throw new Error(`matrix config error: ${matrix.errors.join("; ")}`);
  expectFunded = matrix.config.expectFunded;
});

test.afterAll(async () => {
  if (ctx.dispatcher !== undefined) await ctx.dispatcher.close();
});

test.describe("insufficient-balance validation", () => {
  for (const cell of INSUFFICIENT_CELLS) {
    test(`${cell.name} rejects an amount over an empty balance`, async ({ page, budget, wallet }, testInfo) => {
      budget.route = cell.path;
      allowStagingNoise(budget);
      // The cell asserts the empty-balance error path; a funded wallet renders a different
      // (min/max or over-position) error instead, so the premise is unmet and the cell skips.
      // This is an unfunded-premise skip, NOT a funded-gated one: E2E_EXPECT_FUNDED must never
      // turn it into a failure, so it uses testInfo.skip directly rather than requireOrSkip.
      if (!(await emptyBalancePremiseHolds(cell, ctx, wallet.address))) {
        testInfo.annotations.push({
          type: "matrix-skip",
          description: `${cell.name}: empty-balance premise unmet under a funded wallet`
        });
        testInfo.skip(true, `${cell.name}: funded wallet, empty-balance premise unmet`);
        return;
      }
      await connectThenGoto(page, labels, wallet.address, cell.path);
      await typeAmount(page, cell.inputId, "1");
      // A zero-balance wallet can only reach the balance check (it gates min/max), so every
      // form funnels to the same "Insufficient balance" string.
      await assertFieldError(page, insufficientBalance);

      if (STAKE_CELLS.has(cell.name)) {
        // Stake submit buttons never set the native `disabled` (loading prop doesn't disable
        // — a documented app gap). Assert clicking has no effect: the error persists, the URL
        // stays on the form, and no broadcast/confirmation replaces the field. The dialog's
        // tab shares the submit's label, so target the footer submit (the last match).
        const submit = page.getByRole("button", { name: messageValue(locale, cell.submitKey), exact: true }).last();
        await submit.click();
        await expect(page).toHaveURL(new RegExp(`${cell.path}$`));
        await expect(fieldError(page)).toContainText(insufficientBalance);
      }
    });
  }
});

test.describe("funded-dependent boundary cells", () => {
  test("lease long below-minimum requires a funded, priced down payment", async ({
    page,
    budget,
    wallet
  }, testInfo) => {
    budget.route = "/positions/open/long";
    allowStagingNoise(budget);
    // Below-min/above-max are reachable only past the balance gate, which needs a funded
    // balance in a USD-priced currency comfortably above the protocol minimum. Probe first.
    const micro = await probeNativeMicroBalance(ctx, wallet.address);
    requireOrSkip(
      testInfo,
      expectFunded,
      micro > 0n,
      "connected wallet holds no native balance for a lease down payment"
    );
    // A funded run continues here; the throwaway-wallet local run stops at the skip above.
    await connectThenGoto(page, labels, wallet.address, "/positions/open/long");
    await typeAmount(page, "receive-send", "0.0001");
    await expect(fieldError(page)).toBeVisible({ timeout: CONNECT_TIMEOUT });
  });

  test("earn withdraw over-position requires an existing LP deposit", async ({ page, budget, wallet }, testInfo) => {
    budget.route = "/earn/withdraw";
    allowStagingNoise(budget);
    const hasDeposit = await probeHasEntries(ctx, `/api/earn/positions?address=${wallet.address}`, "positions");
    requireOrSkip(testInfo, expectFunded, hasDeposit, "connected wallet has no LP deposit to over-withdraw");
    await connectThenGoto(page, labels, wallet.address, "/earn/withdraw");
    await typeAmount(page, "receive-send", "1");
    await expect(fieldError(page)).toBeVisible({ timeout: CONNECT_TIMEOUT });
  });

  test("stake undelegate over-position requires an existing delegation", async ({ page, budget, wallet }, testInfo) => {
    budget.route = "/stake/undelegate";
    allowStagingNoise(budget);
    const hasDelegation = await probeHasEntries(ctx, `/api/staking/positions?address=${wallet.address}`, "delegations");
    requireOrSkip(testInfo, expectFunded, hasDelegation, "connected wallet has no delegation to over-undelegate");
    // Undelegate's submit catch never calls classifyError (logs only) — a submit failure
    // renders nothing (a documented app gap), so this cell asserts only the reactive
    // over-amount validation, never a submit-failure message.
    await connectThenGoto(page, labels, wallet.address, "/stake/undelegate");
    await typeAmount(page, "receive-send", "1");
    await expect(fieldError(page)).toBeVisible({ timeout: CONNECT_TIMEOUT });
  });
});
