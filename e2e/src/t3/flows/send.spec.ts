import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import type { RunContext } from "./support.js";
import { getRunContext, reportLeftover, skipIfHalted, spendCommittedOrSkip } from "./support.js";
import { connectKeplr, waitForAppShell, assertConnected } from "../../t2/appDriver.js";
import {
  requireOrSkip,
  probeNativeMicroBalance,
  allowStagingNoise,
  readSwapFromNls,
  waitForSwapReady
} from "../../t2/matrixHelpers.js";
import { makeSendCoin, makeFee, DEFAULT_GAS_LIMIT, NATIVE_DENOM } from "../../transfer.js";
import { broadcastSend } from "../../broadcast.js";
import type { BroadcastResult } from "../../broadcast.js";

// Native NLS send primary -> wallet-2 through the engine (#283 flow 4). The primary is the sole
// governed spend actor, so this is engine.spend with a Node-side broadcast execute. The sender's
// debit is asserted through the rendered Swap From=NLS balance (the receive.spec technique); the
// receiver's credit is confirmed through the host-resolver balances read (asserting a second
// rendered session would need a reconnect and break the single-broadcast model). No matrix cell —
// the balance surface asserted is the swap dialog, not the assets table the funded-gated cell names.

const SEND_NLS = "0.001";
const TERMINAL_MS = 90000;

let run: RunContext;

async function openSwapNls(page: Page, address: string): Promise<void> {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await connectKeplr(page, run.labels);
  await assertConnected(page, address);
  await page.goto("/assets/swap", { waitUntil: "domcontentloaded" });
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  await waitForSwapReady(page);
  await page.locator("#dialog-scroll button.button-secondary").first().click();
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test("a native send debits the sender and credits wallet-2 through the engine", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS + 60000);
  budget.route = "/assets/swap";
  allowStagingNoise(budget);

  const coin = makeSendCoin(SEND_NLS);
  const fee = makeFee(DEFAULT_GAS_LIMIT, run.chain.gasPrice, NATIVE_DENOM);
  const grossMicro = BigInt(coin.amount) + BigInt(fee.amount[0]?.amount ?? "0");
  const senderBalance = await probeNativeMicroBalance(run.ctx, wallet.address);
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    senderBalance > grossMicro,
    `primary holds ${senderBalance.toString()} micro-NLS, below the ${grossMicro.toString()} for a send plus fee`
  );

  await openSwapNls(page, wallet.address);
  const renderedBefore = await readSwapFromNls(page);
  const receiverBefore = await probeNativeMicroBalance(run.ctx, run.secondary.address);

  const result = await spendCommittedOrSkip<BroadcastResult>(testInfo, run, {
    spec: "t3-flow-send",
    action: "native-send",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: grossMicro }],
    denoms: [{ denom: NATIVE_DENOM, micro: grossMicro.toString() }],
    memo: "nolus-e2e-t3-flow",
    outcomeFrom: (value: BroadcastResult) => ({ txHash: value.txHash, height: value.height }),
    execute: () =>
      broadcastSend({
        rpcUrl: run.chain.rpcUrl,
        senderMnemonic: run.primaryMnemonic,
        prefix: "nolus",
        recipient: run.secondary.address,
        amount: coin,
        fee,
        memo: "nolus-e2e-t3-flow"
      })
  });
  testInfo.annotations.push({ type: "t3-send", description: `broadcast at height ${result.height}` });

  await expect
    .poll(() => readSwapFromNls(page), {
      message: "the sender's rendered NLS balance should fall after the send",
      timeout: TERMINAL_MS,
      intervals: [2000, 3000, 5000, 5000, 5000, 5000]
    })
    .toBeLessThan(renderedBefore);

  await expect
    .poll(() => probeNativeMicroBalance(run.ctx, run.secondary.address), {
      message: "wallet-2 should be credited the sent amount",
      timeout: TERMINAL_MS,
      intervals: [2000, 3000, 5000, 5000]
    })
    .toBeGreaterThan(receiverBefore);

  reportLeftover(run, testInfo, { terminal: "success" });
});
