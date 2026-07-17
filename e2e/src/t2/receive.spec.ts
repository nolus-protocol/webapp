import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import type { OriginContext, ConnectLabels } from "./appDriver.js";
import {
  resolveOrigin,
  fetchLocale,
  readConnectLabels,
  connectKeplr,
  waitForAppShell,
  assertConnected
} from "./appDriver.js";
import {
  requireOrSkip,
  probeNativeMicroBalance,
  allowStagingNoise,
  readSwapFromNls,
  waitForSwapReady,
  readString
} from "./matrixHelpers.js";
import { getJson } from "../http.js";
import { parseT2Config, parseMatrixConfig } from "../config.js";
import { createWalletIdentity } from "../signer.js";
import { makeSendCoin, makeFee, DEFAULT_GAS_LIMIT, NATIVE_DENOM } from "../transfer.js";
import { broadcastSend } from "../broadcast.js";

// Live balance-receive: a Node-side bank micro-send from the funded secondary wallet to the
// connected primary, asserted through the rendered balance. NLS is priced at ~0 USD on
// staging (the USD total is effectively inert) and the assets table hides sub-1 balances, so
// this watches the Swap form's From=NLS token balance, which renders the real amount
// unfiltered and updates reactively as the balances store receives the push. The backend
// pushes balance_update only after a ~10s debounce + change detection, and two same-window
// sends coalesce, so the assertion is a monotonic increase of the rendered amount, never a
// push count or exact delta. Serialized project, retries: 0 — a retry must never double-send.

const SEND_AMOUNT_NLS = "0.001";

interface ChainSettings {
  rpcUrl: string;
  gasPrice: string;
}

let ctx: OriginContext;
let locale: unknown;
let labels: ConnectLabels;
let chain: ChainSettings;
let senderMnemonic: string;
let senderAddress: string;
let receiveTimeoutMs: number;
let expectFunded: boolean;

async function resolveChain(matrixRpc: string | undefined): Promise<ChainSettings> {
  const config = await getJson(`${ctx.origin}/api/config`, ctx.dispatcher);
  const networks =
    typeof config === "object" && config !== null ? (config as Record<string, unknown>).networks : undefined;
  const list: unknown[] = Array.isArray(networks) ? (networks as unknown[]) : [];
  // The networks array order is not stable — select Nolus by identity, not by index.
  const nolus = list.find((n) => readString(n, "prefix") === "nolus" || readString(n, "key") === "NOLUS");
  const rpcUrl = matrixRpc ?? readString(nolus, "rpc_url");
  if (rpcUrl === undefined)
    throw new Error("could not resolve the Nolus chain rpc_url from /api/config or E2E_CHAIN_RPC");
  const gasPriceRaw = readString(nolus, "gas_price") ?? "0.025unls";
  const gasPrice = gasPriceRaw.replace(/[^0-9.]/g, "") || "0.025";
  return { rpcUrl, gasPrice };
}

/** Connect the primary on a light route, open Swap, and flip so From shows the NLS balance. */
async function openSwapNls(page: Page, address: string): Promise<void> {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await connectKeplr(page, labels);
  await assertConnected(page, address);
  await page.goto("/assets/swap", { waitUntil: "domcontentloaded" });
  await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
  await waitForSwapReady(page);
  await page.locator("#dialog-scroll button.button-secondary").first().click();
}

test.beforeAll(async () => {
  ctx = resolveOrigin();
  locale = await fetchLocale(ctx);
  labels = readConnectLabels(locale);
  const t2 = parseT2Config(process.env);
  if (!t2.ok) throw new Error(`T2 config error: ${t2.errors.join("; ")}`);
  senderMnemonic = t2.config.secondaryMnemonic;
  senderAddress = (await createWalletIdentity(senderMnemonic)).address;
  const matrix = parseMatrixConfig(process.env);
  if (!matrix.ok) throw new Error(`matrix config error: ${matrix.errors.join("; ")}`);
  receiveTimeoutMs = matrix.config.receiveTimeoutMs;
  expectFunded = matrix.config.expectFunded;
  chain = await resolveChain(matrix.config.chainRpc);
});

test.afterAll(async () => {
  if (ctx.dispatcher !== undefined) await ctx.dispatcher.close();
});

test("a live on-chain receive increases the rendered balance", async ({ page, budget, wallet }, testInfo) => {
  budget.route = "/assets/swap";
  allowStagingNoise(budget);
  test.setTimeout(receiveTimeoutMs + 60000);

  // The sender (secondary/wallet-2) must cover the amount AND the gas fee; probe before
  // touching the chain so a pot funded between amount and amount+fee skips cleanly instead
  // of broadcasting a tx that fails on insufficient funds.
  const coin = makeSendCoin(SEND_AMOUNT_NLS);
  const fee = makeFee(DEFAULT_GAS_LIMIT, chain.gasPrice, NATIVE_DENOM);
  const required = BigInt(coin.amount) + BigInt(fee.amount[0]?.amount ?? "0");
  const senderBalance = await probeNativeMicroBalance(ctx, senderAddress);
  requireOrSkip(
    testInfo,
    expectFunded,
    senderBalance > required,
    `sender ${senderAddress} is not funded enough for a ${SEND_AMOUNT_NLS} NLS send plus fee`
  );

  await openSwapNls(page, wallet.address);
  const before = await readSwapFromNls(page);
  const result = await broadcastSend({
    rpcUrl: chain.rpcUrl,
    senderMnemonic,
    prefix: "nolus",
    recipient: wallet.address,
    amount: coin,
    fee,
    memo: "nolus-e2e-receive"
  });
  testInfo.annotations.push({ type: "receive-tx", description: `broadcast at height ${result.height}` });

  await expect
    .poll(() => readSwapFromNls(page), {
      message: "the rendered NLS balance should increase after the on-chain receive",
      timeout: receiveTimeoutMs,
      intervals: [2000, 3000, 5000, 5000, 5000, 5000, 5000]
    })
    .toBeGreaterThan(before);
});
