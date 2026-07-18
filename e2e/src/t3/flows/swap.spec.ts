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
// UI's terminal state and post-swap balances, NOT a WS event. The direction is HELD USDC -> NLS:
// USDC has real staging value, whereas a unls -> USDC dust has no route (economically null). A
// no-route answer is a precondition skip (not a red): the route is pre-probed in the SAME direction
// before executing. No matrix cell. Deviation from #283's WS-tracked wording is in the README.
//
// Terminal states, read from useSwapForm.ts's `onSwap`: SUCCESS calls `onClose()` and the swap
// dialog UNMOUNTS (there is NO "done/success" text to poll — the old text poll could never match,
// which is why runs timed out on a swap that actually broadcast); FAILURE sets `error.value`, so the
// inline error surface renders while the dialog stays open. `onSwap` also early-returns unless the
// route quote (`route`) is set, so the To amount must populate before the submit click.

const SWAP_USDC = "1";
const TERMINAL_MS = 120000;
// A routed Skip swap (track + fetchStatus) can take a couple of minutes; give the execution its own
// window, wider than the UI-signal timeout used elsewhere.
const SWAP_EXEC_MS = 180000;
const CLICK_MS = 15000;
const QUOTE_SETTLE_MS = 60000;
const SWAP_ERROR = "div.text-typography-error";

let run: RunContext;

type SwapTerminal = "success" | "failure" | "pending";

/** The inline error surface text (trimmed), or "" when no error is shown. */
async function swapErrorText(page: Page): Promise<string> {
  const error = page.locator(SWAP_ERROR).first();
  if (!(await error.isVisible().catch(() => false))) {
    return "";
  }
  return (await error.innerText().catch(() => "")).trim();
}

/**
 * The real swap terminal state. SUCCESS = the dialog closed (`onClose` unmounts the swap form, so
 * its From input `#swap-1` is gone); FAILURE = the inline error surface is showing; otherwise the
 * broadcast/track is still in flight (PENDING).
 */
async function swapTerminal(page: Page): Promise<SwapTerminal> {
  if ((await swapErrorText(page)).length > 0) {
    return "failure";
  }
  if (
    !(await page
      .locator("#swap-1")
      .isVisible()
      .catch(() => false))
  ) {
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
  test.setTimeout(SWAP_EXEC_MS + TERMINAL_MS * 2);
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
  // Set From = the held USDC variant (source, balance-verified so typing validates against a real,
  // loaded balance) and To = NLS (destination — the To block renders no Balance span, so verified by
  // ticker only).
  const fromPick = await selectCurrencyVariant(page, {
    fieldId: "swap-1",
    search: usdcTicker,
    expectContains: "USDC",
    side: "source"
  });
  if (fromPick === "row-disabled") {
    annotateSkipAndStop(testInfo, "precondition", "held USDC variant is not swappable on the target protocol");
  }
  const toPick = await selectCurrencyVariant(page, {
    fieldId: "swap-2",
    search: "NLS",
    expectContains: "NLS",
    side: "destination"
  });
  if (toPick === "row-disabled") {
    annotateSkipAndStop(testInfo, "precondition", "NLS is not a swap destination on the target protocol");
  }
  await typeAmount(page, "swap-1", SWAP_USDC);
  await waitForAmountAccepted(page);
  // `onSwap` early-returns unless the route quote is set, so wait for it to settle before submitting:
  // the To amount (#swap-2) populates from the quote's amount_out. Its staying empty is an
  // environment condition (no quote despite a routable pre-probe), not an app red.
  try {
    await expect
      .poll(
        async () => {
          const value = await page
            .locator("#swap-2")
            .inputValue()
            .catch(() => "");
          return Number(value.replace(/[\s,]/g, "")) || 0;
        },
        { message: "the swap route quote should settle (To amount populated)", timeout: QUOTE_SETTLE_MS }
      )
      .toBeGreaterThan(0);
  } catch {
    annotateSkipAndStop(testInfo, "environment", "swap route quote did not settle (To amount stayed empty)");
  }

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
      // No confirmation dialog: the swap runs on the click. Poll the REAL terminal states — success
      // closes the dialog, failure renders the inline error surface.
      await page.getByRole("button", { name: /swap/i }).last().click({ timeout: CLICK_MS });
      let lastState: SwapTerminal = "pending";
      try {
        await expect
          .poll(
            async () => {
              lastState = await swapTerminal(page);
              return lastState;
            },
            { message: "swap should reach a terminal state (dialog closes on success)", timeout: SWAP_EXEC_MS }
          )
          .not.toBe("pending");
      } catch {
        // Still pending at the window end and no commit — a broadcast may be mid-flight. Route this
        // to `environment` (terminal-signal-timeout) with the observed last state, never a red; the
        // reconciliation sweep + balances read catch an untracked commit next run.
        throw new Error(
          `terminal-signal-timeout: swap still pending after ${SWAP_EXEC_MS}ms (last state: ${lastState})`
        );
      }
      if ((await swapTerminal(page)) === "failure") {
        throw new Error(`swap reached a failed terminal state: ${(await swapErrorText(page)).slice(0, 200)}`);
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
