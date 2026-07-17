import { test, expect } from "./support.js";
import type { Page, TestInfo } from "@playwright/test";
import type { RunContext } from "./support.js";
import {
  getRunContext,
  connectFlow,
  reportLeftover,
  skipIfHalted,
  spendCommittedOrSkip,
  annotateSkipAndStop,
  classifyAndRoute
} from "./support.js";
import { messageValue } from "../../t2/appDriver.js";
import { typeAmount, requireOrSkip, readString } from "../../t2/matrixHelpers.js";
import { USDC_DECIMALS } from "../../config.js";
import { toMicroAmount } from "../../transfer.js";
import { Decimal } from "../../oracle/decimal.js";
import { computeLiquidation, leaseSizeCell } from "../../oracle/lease.js";
import {
  usdcMicro,
  assetMicro,
  probeSwapRoute,
  openedLease,
  leaseProtocolConfigs,
  heldAssetUsd,
  currencies,
  fetchBalances
} from "./apiReads.js";
import { submitForm, openDetailDialog, waitForAmountAccepted } from "./formDriver.js";
import { remainsAboveMin } from "./preconditions.js";
import { planLeaseDownpayment } from "./leasePlan.js";
import type { LeaseDownpaymentPlan } from "./leasePlan.js";
import { resolveShortLeaseStable } from "./sideSelection.js";
import type { LeaseSide } from "./sideSelection.js";
import { assertNonZeroBasis } from "./tolerance.js";
import { findAnimatedFigure, findAnimatedFigureWithinTolerance } from "./renderFigure.js";
import { USDC_DENOM } from "./denoms.js";
import { bankDenomOf, heldUsdcVariant } from "./denomResolver.js";

// The alternating-side single-lease lifecycle (#283 flow 1), run same-run on ONE opened lease so
// the pre-run sweep never sees a cross-run orphan: open → TP/SL create + edit → dust repay
// (min_transaction) → partial close (leaving ≥ min_asset) → market close. The side is chosen by
// UTC day-of-year parity unless E2E_LEASE_SIDE pins it. No protocol accepts USDC/NLS as
// downpayment (ranges are lease assets), so the downpayment is planned by `planLeaseDownpayment`:
// prefer a held ranged asset (recycled from a prior run), else ACQUIRE the target (OSMO) by
// swapping USDC through the engine (capped in USDC), else precondition-skip. The subsequent lease
// legs move the acquired OSMO, whose outflow is journaled but bounded by the acquired amount — the
// caps bound the acquisition, not the recycled asset. Post-flow math is asserted against the
// EXISTING render oracle on the non-zero-priced collateral leg. Matrix labels: flow-lease-row,
// flow-lease-detail, flow-lease-crossfield.

const TERMINAL_MS = 150000;
const MIN_ASSET_USDC = "15";
const MIN_TRANSACTION_USDC = "0.01";
const TP_TRIGGER_PERCENT = "5";
const TP_EDIT_PERCENT = "8";
const ACQUIRE_TARGET = "OSMO";
const ACQUIRE_BUFFER_USD = "5";
// OSMO's decimals for converting a micro balance to the downpayment form amount (CI-confirmed).
const OSMO_DECIMALS = 6;

let run: RunContext;

function dec(value: string | undefined): Decimal {
  return Decimal.fromString(value !== undefined && /^-?\d+(\.\d+)?$/.test(value) ? value : "0");
}

function oracleSize(lease: Record<string, unknown>, side: LeaseSide): string {
  const ticker = readString(lease, "ticker");
  return leaseSizeCell({
    positionType: side === "short" ? "Short" : "Long",
    unitAsset: dec(readString(lease, "unit_asset")),
    assetValueUsd: dec(readString(lease, "asset_value_usd")),
    ...(ticker !== undefined ? { cryptoShortName: ticker } : {}),
    cryptoPriceUsd: dec(readString(lease, "price"))
  }).value;
}

/** Open the take-profit / stop-loss trigger dialog, set a trigger, and submit (submit-btn → toast). */
async function setTakeProfitStopLoss(page: Page, triggerPercent: string): Promise<void> {
  await page
    .getByRole("button", { name: /take.?profit|stop.?loss|tp\s?\/?\s?sl/i })
    .first()
    .click({ timeout: TERMINAL_MS });
  await typeAmount(page, "receive-send", triggerPercent);
  await waitForAmountAccepted(page);
  await submitForm(page, { submitLabel: messageValue(run.locale, "submit-btn"), terminalMs: TERMINAL_MS });
}

/**
 * Drive the close flow. The `close` action opens the CloseDialog (a single amount input + full/debt
 * selector and a `close-btn-label` submit — there are no separate market/partial buttons): a market
 * close selects the full position, a partial close types the amount. The submit settles on the
 * success toast via `submitForm`.
 */
async function driveClose(page: Page, mode: "market" | "partial", amount?: string): Promise<void> {
  await page.getByRole("button", { name: /close/i }).first().click({ timeout: TERMINAL_MS });
  if (mode === "partial" && amount !== undefined) {
    await typeAmount(page, "receive-send", amount);
    await waitForAmountAccepted(page);
  } else {
    await page
      .getByText(/full/i)
      .first()
      .click({ timeout: TERMINAL_MS })
      .catch(() => undefined);
  }
  await submitForm(page, { submitLabel: messageValue(run.locale, "close-btn-label"), terminalMs: TERMINAL_MS });
}

/** Assert the opened lease's rendered row, detail size, and liquidation ordering against the oracle. */
async function assertOpenedLeaseOracle(
  page: Page,
  testInfo: TestInfo,
  opened: Record<string, unknown>,
  side: LeaseSide
): Promise<void> {
  const address = readString(opened, "address") ?? "";
  testInfo.annotations.push({ type: "matrix", description: "flow-lease-row" });
  await expect(page.getByText(address, { exact: false }).first()).toBeVisible({ timeout: TERMINAL_MS });

  testInfo.annotations.push({ type: "matrix", description: "flow-lease-detail" });
  await openDetailDialog(page, address, TERMINAL_MS);
  const dialog = page.locator("#dialog-scroll").first();
  const expectedUsd = dec(readString(opened, "asset_value_usd")).toString(2);
  assertNonZeroBasis({ value: expectedUsd, description: `${side} lease value` });
  // The detail figures animate via AnimateNumber — assert against the aria-label, not innerText.
  expect(await findAnimatedFigure(dialog, oracleSize(opened, side), TERMINAL_MS)).toBe(true);
  expect(await findAnimatedFigureWithinTolerance(dialog, expectedUsd, run.usdTolerance, TERMINAL_MS)).toBe(true);

  testInfo.annotations.push({ type: "matrix", description: "flow-lease-crossfield" });
  const spot = dec(readString(opened, "price"));
  const liquidation = computeLiquidation({
    serverPrice: readString(opened, "liquidation_price") ?? null,
    positionType: side === "short" ? "Short" : "Long",
    debt: dec(readString(opened, "debt")),
    collateral: dec(readString(opened, "collateral"))
  });
  if (spot.isPositive() && liquidation.isPositive()) {
    expect(side === "short" ? liquidation.gt(spot) : spot.gt(liquidation)).toBe(true);
  } else {
    expect(liquidation.isNegative()).toBe(false);
  }
}

/** The wallet's USDC balance expressed in USD (USDC ~ $1 at 6 decimals), summed by resolved denom. */
async function usdcHeldUsd(ctx: RunContext["ctx"], address: string): Promise<Decimal> {
  return Decimal.fromAtomics((await usdcMicro(ctx, address, run.currencyResolver)).toString(), USDC_DECIMALS);
}

/** Acquire the downpayment asset by swapping USDC through the engine — capped in USDC, route-gated. */
async function acquireDownpaymentAsset(page: Page, testInfo: TestInfo, acquireUsd: Decimal): Promise<void> {
  const acquireMicro = toMicroAmount(acquireUsd.toString(USDC_DECIMALS), USDC_DECIMALS);
  // The acquisition swap spends the USDC the wallet holds, so probe that variant (USDC_NOBLE
  // fallback for a fresh wallet); the dest is the acquired OSMO downpayment asset.
  const sourceDenom = heldUsdcVariant(run.currencyResolver, await fetchBalances(run.ctx, run.primary.address));
  const destDenom = bankDenomOf(run.currencyResolver, ACQUIRE_TARGET);
  if (sourceDenom === undefined || destDenom === undefined) {
    annotateSkipAndStop(testInfo, "environment", `swap-route denom unresolved (USDC or ${ACQUIRE_TARGET})`);
  }
  const route = await probeSwapRoute(
    { ctx: run.ctx, queue: run.queue, chainId: run.chain.chainId },
    { sourceDenom, destDenom, amountMicro: acquireMicro }
  );
  if (route.status === "error") {
    annotateSkipAndStop(testInfo, "environment", `acquire route probe failed: ${route.reason}`);
  }
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    route.status === "routable",
    `no swap route to acquire the ${ACQUIRE_TARGET} downpayment`
  );
  await connectFlow(page, run, "/assets/swap");
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-lease-acquire",
    action: "swap",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "usdc", micro: BigInt(acquireMicro) }],
    denoms: [{ denom: USDC_DENOM, micro: acquireMicro }],
    memo: `acquire ${ACQUIRE_TARGET} downpayment`,
    execute: async () => {
      await run.queue.pace("strict");
      await page.locator("#swap-1").waitFor({ state: "visible", timeout: 15000 });
      // The swap runs on the click (no confirmation dialog); settle on the success toast / error.
      await submitForm(page, { submitLabel: messageValue(run.locale, "swap"), terminalMs: TERMINAL_MS });
    }
  });
}

interface ResolvedDownpayment {
  asset: string;
  protocol: string;
  amount: string;
  micro: bigint;
}

/** Plan and secure the downpayment (held / acquire / skip), returning the target-asset amount to open with. */
async function resolveDownpayment(
  page: Page,
  testInfo: TestInfo,
  address: string,
  side: LeaseSide
): Promise<ResolvedDownpayment> {
  let protocols: Awaited<ReturnType<typeof leaseProtocolConfigs>>;
  try {
    protocols = await leaseProtocolConfigs(run.ctx, () => run.queue.pace("standard"));
  } catch (error) {
    // An all-configs-failed outage (lease-config-unavailable) is a transient environment skip that
    // retries next run, not a permanent precondition.
    classifyAndRoute(testInfo, error, run.chain.rpcUrl);
  }
  const plan: LeaseDownpaymentPlan = planLeaseDownpayment({
    protocols,
    heldUsd: await heldAssetUsd(run.ctx, address, run.currencyResolver, run.pricesPayload),
    usdcUsd: await usdcHeldUsd(run.ctx, address),
    acquireTarget: ACQUIRE_TARGET,
    acquireBufferUsd: Decimal.fromString(ACQUIRE_BUFFER_USD)
  });
  if (plan.kind === "skip") {
    testInfo.annotations.push({ type: "matrix-skip", description: `lease downpayment: ${plan.reason}` });
    annotateSkipAndStop(testInfo, "precondition", `lease downpayment unavailable: ${plan.reason}`);
  }
  if (plan.kind === "acquire") {
    await acquireDownpaymentAsset(page, testInfo, plan.acquireUsd);
  }
  const micro = await assetMicro(run.ctx, address, run.currencyResolver, ACQUIRE_TARGET);
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    micro > 0n,
    `no ${ACQUIRE_TARGET} balance to fund the ${side} lease downpayment`
  );
  return {
    asset: plan.asset,
    protocol: plan.protocol,
    amount: Decimal.fromAtomics(micro.toString(), OSMO_DECIMALS).toString(OSMO_DECIMALS),
    micro
  };
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test("a single alternating-side lease runs its full lifecycle through the engine", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 6);
  const side: LeaseSide = run.leaseSides[0] ?? "long";
  budget.route = `/positions/open/${side}`;

  // Plan the downpayment: a held ranged asset, an acquisition swap, or a clean precondition skip.
  const downpayment = await resolveDownpayment(page, testInfo, wallet.address, side);

  await connectFlow(page, run, `/positions/open/${side}`);
  await typeAmount(page, "receive-send", downpayment.amount);
  await waitForAmountAccepted(page);
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-lease",
    action: "lease-open",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: downpayment.asset, micro: downpayment.micro.toString() }],
    execute: () => submitForm(page, { submitLabel: messageValue(run.locale, "open-position"), terminalMs: TERMINAL_MS })
  });
  const protocol = downpayment.protocol;

  await page.goto("/positions", { waitUntil: "domcontentloaded" });
  const lease = await openedLease(run.ctx, wallet.address);
  requireOrSkip(testInfo, run.matrix.expectFunded, lease !== undefined, "no opened lease enumerated after open");
  const opened = lease ?? {};
  const address = readString(opened, "address") ?? "";

  // #283 acceptance: a short position is denominated in the lease-group stable, never the LPN.
  if (side === "short") {
    const stableTicker = resolveShortLeaseStable(await currencies(run.ctx));
    expect(readString(opened, "ticker")).toBe(stableTicker);
  }

  await assertOpenedLeaseOracle(page, testInfo, opened, side);

  // TP/SL create + edit (config-only; the app does not attach funds, so it bypasses the engine).
  await setTakeProfitStopLoss(page, TP_TRIGGER_PERCENT);
  await setTakeProfitStopLoss(page, TP_EDIT_PERCENT);
  await expect(page.locator("#dialog-scroll").first()).toBeVisible({ timeout: TERMINAL_MS });

  // Dust repay (min_transaction): debt must fall.
  const debtBefore = dec(readString(opened, "total_debt_usd") ?? readString(opened, "debt"));
  const repayMicro = BigInt(toMicroAmount(MIN_TRANSACTION_USDC, USDC_DECIMALS));
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-lease",
    action: "lease-repay",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "usdc", micro: repayMicro }],
    denoms: [{ denom: USDC_DENOM, micro: repayMicro.toString() }],
    execute: async () => {
      await page.getByRole("button", { name: /repay/i }).first().click({ timeout: TERMINAL_MS });
      await typeAmount(page, "receive-send", MIN_TRANSACTION_USDC);
      await waitForAmountAccepted(page);
      await submitForm(page, { submitLabel: messageValue(run.locale, "repay"), terminalMs: TERMINAL_MS });
    }
  });
  const afterRepay = (await openedLease(run.ctx, wallet.address)) ?? {};
  const debtAfter = dec(readString(afterRepay, "total_debt_usd") ?? readString(afterRepay, "debt"));
  if (debtBefore.isPositive()) {
    expect(debtAfter.gt(debtBefore)).toBe(false);
  }

  // Partial close leaving ≥ min_asset (wires the remainsAboveMin guard).
  const positionMicro = BigInt(
    toMicroAmount(dec(readString(afterRepay, "asset_value_usd")).toString(USDC_DECIMALS), USDC_DECIMALS)
  );
  const minAssetMicro = BigInt(toMicroAmount(MIN_ASSET_USDC, USDC_DECIMALS));
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    remainsAboveMin(positionMicro - repayMicro, minAssetMicro),
    `position ${positionMicro.toString()} micro-USDC cannot leave ${MIN_ASSET_USDC} USDC after a dust partial close`
  );
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-lease",
    action: "lease-close",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: USDC_DENOM, micro: repayMicro.toString() }],
    memo: "partial close",
    execute: () => driveClose(page, "partial", MIN_TRANSACTION_USDC)
  });

  // Market close (full): the lease must no longer enumerate as opened.
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-lease",
    action: "lease-close",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: USDC_DENOM, micro: "0" }],
    memo: "market close",
    execute: () => driveClose(page, "market")
  });
  const stillOpen = await openedLease(run.ctx, wallet.address);
  const leftoverOpen =
    stillOpen === undefined
      ? []
      : [{ address, protocol: readString(opened, "protocol") ?? protocol, status: "opened" }];

  reportLeftover(run, testInfo, { terminal: "success", openLeases: leftoverOpen });
});
