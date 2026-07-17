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
import { typeAmount, requireOrSkip, waitForFundedFromNls } from "../../t2/matrixHelpers.js";
import { NATIVE_DENOM, NATIVE_DECIMALS, toMicroAmount } from "../../transfer.js";
import { usdcMicro, probeSwapRoute, fetchBalances } from "./apiReads.js";
import { heldUsdcVariant } from "./denomResolver.js";
import { waitForAmountAccepted } from "./formDriver.js";

// Quote -> execute a dust swap (#283 flow 6). The Skip WS topic is DEAD CODE — the app tracks
// swaps by client polling (SkipRouter.fetchStatus in useSwapForm.ts), so this asserts through the
// UI's polled terminal state and post-swap balances, NOT a WS event. A dust amount routinely has
// no route, which is a precondition skip (not a red): the route is pre-probed before executing.
// No matrix cell. Deviation from #283's acceptance wording (WS-tracked) documented in the README.

const SWAP_NLS = "0.01";
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

  const amountMicro = toMicroAmount(SWAP_NLS, NATIVE_DECIMALS);
  // Probe (and swap) into the USDC variant the wallet actually holds so the routability answer
  // matches the balance the post-swap assertion reads; USDC_NOBLE is the fresh-wallet fallback.
  const destDenom = heldUsdcVariant(run.currencyResolver, await fetchBalances(run.ctx, wallet.address));
  if (destDenom === undefined) {
    annotateSkipAndStop(testInfo, "environment", "USDC bank denom unresolved from /api/currencies");
  }
  const route = await probeSwapRoute(
    { ctx: run.ctx, queue: run.queue, chainId: run.chain.chainId },
    { sourceDenom: NATIVE_DENOM, destDenom, amountMicro }
  );
  if (route.status === "error") {
    annotateSkipAndStop(testInfo, "environment", `swap route probe failed: ${route.reason}`);
  }
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    route.status === "routable",
    "no Skip route for the dust swap amount"
  );

  await connectFlow(page, run, "/assets/swap");
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  await waitForFundedFromNls(page);
  await typeAmount(page, "swap-1", SWAP_NLS);
  await waitForAmountAccepted(page);

  const usdcBefore = await usdcMicro(run.ctx, wallet.address, run.currencyResolver);
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-swap",
    action: "swap",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: BigInt(amountMicro) }],
    denoms: [{ denom: NATIVE_DENOM, micro: amountMicro }],
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
    .poll(() => usdcMicro(run.ctx, wallet.address, run.currencyResolver), {
      message: "the swapped-to USDC balance should strictly increase after a committed swap",
      timeout: TERMINAL_MS,
      intervals: [3000, 5000, 5000, 5000]
    })
    .toBeGreaterThan(usdcBefore);

  reportLeftover(run, testInfo, { terminal: "success" });
});
