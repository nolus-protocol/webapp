import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import type { RunContext } from "./support.js";
import {
  getRunContext,
  connectFlow,
  reportLeftover,
  skipIfHalted,
  spendCommittedOrSkip,
  annotateSkipAndStop
} from "./support.js";
import { typeAmount, requireOrSkip } from "../../t2/matrixHelpers.js";
import { NATIVE_DENOM, toMicroAmount } from "../../transfer.js";
import { USDC_DECIMALS } from "../../config.js";
import { usdcMicro, probeSwapRoute, nativeMicro, heldUsdcTicker } from "./apiReads.js";
import { bankDenomOf } from "./denomResolver.js";
import { waitForAmountAccepted, selectCurrencyVariant } from "./formDriver.js";

// Quote -> execute a dust swap (#283 flow 6). The Skip WS topic is DEAD CODE — the app tracks
// swaps by client polling (SkipRouter.fetchStatus in useSwapForm.ts), so this asserts through the
// UI's polled terminal state and post-swap balances, NOT a WS event. The direction is HELD USDC ->
// NLS: USDC has real staging value, whereas a unls -> USDC dust has no route (economically null).
// A no-route answer is a precondition skip (not a red): the route is pre-probed in the SAME
// direction before executing. No matrix cell. Deviation from #283's WS-tracked wording is in the README.

const SWAP_USDC = "1";
const TERMINAL_MS = 120000;

let run: RunContext;

type SwapTerminal = "success" | "failure" | "pending";

async function swapDialogText(page: Page): Promise<string> {
  return page
    .locator("#dialog-scroll")
    .first()
    .innerText()
    .catch(() => "");
}

/** The app's polled swap state — success and failure are both terminal, only failure must not pass. */
async function swapTerminal(page: Page): Promise<SwapTerminal> {
  const text = (await swapDialogText(page)).toLowerCase();
  if (/failed|error|rejected/.test(text)) {
    return "failure";
  }
  if (/done|success|completed/.test(text)) {
    return "success";
  }
  return "pending";
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test("a dust swap executes and reaches a polled terminal state with settled balances", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/assets/swap";

  const amountMicro = toMicroAmount(SWAP_USDC, USDC_DECIMALS);
  // Spend the USDC variant the wallet actually holds -> NLS, so the routability probe, the cap
  // charge, and the picked From asset all name the same real balance.
  const usdcTicker = await heldUsdcTicker(run.ctx, wallet.address, run.currencyResolver);
  if (usdcTicker === undefined) {
    annotateSkipAndStop(testInfo, "precondition", "no funded USDC variant to swap from");
  }
  const sourceDenom = bankDenomOf(run.currencyResolver, usdcTicker);
  if (sourceDenom === undefined) {
    annotateSkipAndStop(testInfo, "environment", "USDC bank denom unresolved from /api/currencies");
  }
  const usdcHeld = await usdcMicro(run.ctx, wallet.address, run.currencyResolver);
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    usdcHeld > BigInt(amountMicro),
    `primary holds ${usdcHeld.toString()} micro-USDC, below the ${amountMicro} a $${SWAP_USDC} swap needs`
  );

  const route = await probeSwapRoute(
    { ctx: run.ctx, queue: run.queue, chainId: run.chain.chainId },
    { sourceDenom, destDenom: NATIVE_DENOM, amountMicro }
  );
  if (route.status === "error") {
    annotateSkipAndStop(testInfo, "environment", `swap route probe failed: ${route.reason}`);
  }
  if (route.status !== "routable") {
    annotateSkipAndStop(testInfo, "precondition", `no Skip route for the $${SWAP_USDC} USDC->NLS swap`);
  }

  await connectFlow(page, run, "/assets/swap");
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  // Set From = the held USDC variant, To = NLS; each pick is verified to have landed on a positive
  // balance so typing validates against a real balance (not the default or an unloaded zero).
  await selectCurrencyVariant(page, {
    fieldId: "swap-1",
    search: usdcTicker,
    expectContains: "USDC",
    timeoutMs: TERMINAL_MS
  });
  await selectCurrencyVariant(page, {
    fieldId: "swap-2",
    search: "NLS",
    expectContains: "NLS",
    timeoutMs: TERMINAL_MS
  });
  await typeAmount(page, "swap-1", SWAP_USDC);
  await waitForAmountAccepted(page);

  const nlsBefore = await nativeMicro(run.ctx, wallet.address);
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-swap",
    action: "swap",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "usdc", micro: BigInt(amountMicro) }],
    denoms: [{ denom: sourceDenom, micro: amountMicro }],
    execute: async () => {
      await run.queue.pace("strict");
      // The swap runs on the click (no confirmation dialog); track the app's polled terminal state.
      await page.getByRole("button", { name: /swap/i }).last().click({ timeout: TERMINAL_MS });
      await expect
        .poll(() => swapTerminal(page), {
          message: "swap should reach a polled terminal state",
          timeout: TERMINAL_MS
        })
        .not.toBe("pending");
      if ((await swapTerminal(page)) === "failure") {
        throw new Error(`swap reached a failed terminal state: ${(await swapDialogText(page)).slice(0, 200)}`);
      }
    }
  });

  await expect
    .poll(() => nativeMicro(run.ctx, wallet.address), {
      message: "the swapped-to NLS balance should strictly increase after a committed swap",
      timeout: TERMINAL_MS,
      intervals: [3000, 5000, 5000, 5000]
    })
    .toBeGreaterThan(nlsBefore);

  reportLeftover(run, testInfo, { terminal: "success" });
});
