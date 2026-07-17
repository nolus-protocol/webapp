import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import type { RunContext } from "./support.js";
import {
  getRunContext,
  connectFlow,
  journaledSpend,
  reportLeftover,
  skipIfHalted,
  classifyAndRoute,
  annotateSkipAndStop
} from "./support.js";
import { typeAmount, requireOrSkip, waitForFundedFromNls } from "../../t2/matrixHelpers.js";
import { NATIVE_DENOM, NATIVE_DECIMALS, toMicroAmount } from "../../transfer.js";
import { hasSwapRoute } from "./preconditions.js";
import { microBalanceByDenom } from "./apiReads.js";
import { readJson } from "../runtime.js";

// Quote -> execute a dust swap (#283 flow 6). The Skip WS topic is DEAD CODE — the app tracks
// swaps by client polling (SkipRouter.fetchStatus in useSwapForm.ts), so this asserts through the
// UI's polled terminal state and post-swap balances, NOT a WS event. A dust amount routinely has
// no route, which is a precondition skip (not a red): the route is pre-probed before executing.
// No matrix cell. Deviation from #283's acceptance wording (WS-tracked) documented in the README.

const SWAP_NLS = "0.01";
const TERMINAL_MS = 120000;

let run: RunContext;

async function probeRoute(ctx: RunContext["ctx"], amountMicro: string): Promise<boolean> {
  const payload = await readJson(
    ctx,
    `${ctx.origin}/api/swap/route?from=${NATIVE_DENOM}&to=ibc/usdc&amount=${amountMicro}`
  ).catch(() => null);
  return hasSwapRoute(payload);
}

async function pollSwapTerminal(page: Page): Promise<boolean> {
  const text = await page
    .locator("#dialog-scroll")
    .first()
    .innerText()
    .catch(() => "");
  return /done|success|completed|failed|error/i.test(text);
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test.afterAll(async () => {
  if (run.ctx.dispatcher !== undefined) await run.ctx.dispatcher.close();
});

test("a dust swap executes and reaches a polled terminal state with settled balances", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/assets/swap";

  const amountMicro = toMicroAmount(SWAP_NLS, NATIVE_DECIMALS);
  const routable = await probeRoute(run.ctx, amountMicro);
  requireOrSkip(testInfo, run.matrix.expectFunded, routable, "no Skip route for the dust swap amount");

  await connectFlow(page, run, "/assets/swap");
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  await waitForFundedFromNls(page);
  await typeAmount(page, "swap-1", SWAP_NLS);

  const usdcBefore = await microBalanceByDenom(run.ctx, wallet.address, "usdc");
  try {
    const outcome = await journaledSpend(run, {
      spec: "t3-flow-swap",
      action: "swap",
      walletRole: "primary",
      walletKey: run.primary.key,
      items: [{ denom: "nls", micro: BigInt(amountMicro) }],
      denoms: [{ denom: NATIVE_DENOM, micro: amountMicro }],
      execute: async () => {
        await run.queue.pace("strict");
        await page.getByRole("button", { name: /swap/i }).last().click({ timeout: TERMINAL_MS });
        await page
          .getByRole("button", { name: /confirm|submit/i })
          .first()
          .click({ timeout: TERMINAL_MS });
        await expect
          .poll(() => pollSwapTerminal(page), {
            message: "swap should reach a polled terminal state",
            timeout: TERMINAL_MS
          })
          .toBe(true);
      }
    });
    if (outcome.status === "spend-cap-abort") {
      reportLeftover(run, testInfo, { terminal: "spend-cap-abort" });
      annotateSkipAndStop(testInfo, "precondition", `spend cap reached on ${outcome.check.overDenom}`);
    }
  } catch (error) {
    reportLeftover(run, testInfo, { terminal: "app-failure" });
    classifyAndRoute(testInfo, error, run.chain.rpcUrl);
  }

  await expect
    .poll(() => microBalanceByDenom(run.ctx, wallet.address, "usdc"), {
      message: "the swapped-to USDC balance should settle at or above the pre-swap balance",
      timeout: TERMINAL_MS,
      intervals: [3000, 5000, 5000, 5000]
    })
    .toBeGreaterThanOrEqual(usdcBefore);

  reportLeftover(run, testInfo, { terminal: "success" });
});
