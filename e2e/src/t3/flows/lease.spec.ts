import { test, expect } from "./support.js";
import type { Page, TestInfo } from "@playwright/test";
import type { RunContext } from "./support.js";
import { getRunContext, connectFlow, reportLeftover, skipIfHalted, spendCommittedOrSkip } from "./support.js";
import { messageValue } from "../../t2/appDriver.js";
import { typeAmount, requireOrSkip, readString } from "../../t2/matrixHelpers.js";
import { USDC_DECIMALS } from "../../config.js";
import { toMicroAmount } from "../../transfer.js";
import { Decimal } from "../../oracle/decimal.js";
import { computeLiquidation, leaseSizeCell } from "../../oracle/lease.js";
import { microBalanceByDenom, openedLease, leaseConfig, firstProtocol, currencies } from "./apiReads.js";
import { submitForm, openDetailDialog } from "./formDriver.js";
import { resolveDownpaymentFloorUsd, remainsAboveMin } from "./preconditions.js";
import { resolveShortLeaseStable } from "./sideSelection.js";
import type { LeaseSide } from "./sideSelection.js";
import { assertNonZeroBasis, assertWithinTolerance } from "./tolerance.js";
import { USDC_DENOM } from "./denoms.js";

// The alternating-side single-lease lifecycle (#283 flow 1), run same-run on ONE opened lease so
// the pre-run sweep never sees a cross-run orphan: open → TP/SL create + edit → dust repay
// (min_transaction) → partial close (leaving ≥ min_asset) → market close. The side is chosen by
// UTC day-of-year parity unless E2E_LEASE_SIDE pins it; USDC is the only viable downpayment denom
// (NLS is priced ~$0, so its USD figures are vacuous). Post-flow math is asserted against the
// EXISTING render oracle on the non-zero-priced collateral leg, and each teardown step is checked
// against chain-enumerated state. Matrix labels: flow-lease-row, flow-lease-detail,
// flow-lease-crossfield.

const TERMINAL_MS = 150000;
const MIN_ASSET_USDC = "15";
const MIN_TRANSACTION_USDC = "0.01";
const TP_TRIGGER_PERCENT = "5";
const TP_EDIT_PERCENT = "8";

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

/** The first `$`-prefixed amount rendered in a dialog, digits only, or undefined. */
function firstUsdAmount(text: string): string | undefined {
  const match = text.match(/\$\s?([0-9][0-9,]*(?:\.[0-9]+)?)/);
  const raw = match?.[1];
  return raw === undefined ? undefined : raw.replace(/,/g, "");
}

/** Set the take-profit / stop-loss trigger in the open lease detail dialog (config-only, no spend). */
async function setTakeProfitStopLoss(page: Page, triggerPercent: string): Promise<void> {
  await page
    .getByRole("button", { name: /take.?profit|stop.?loss|tp\s?\/?\s?sl/i })
    .first()
    .click({ timeout: TERMINAL_MS });
  await typeAmount(page, "receive-send", triggerPercent);
  await page
    .getByRole("button", { name: /save|set|apply|confirm/i })
    .first()
    .click({ timeout: TERMINAL_MS });
}

/** Drive the detail-dialog close flow — market (full) or partial with an amount. */
async function driveClose(page: Page, mode: "market" | "partial", amount?: string): Promise<void> {
  await page.getByRole("button", { name: /close/i }).first().click({ timeout: TERMINAL_MS });
  await page
    .getByRole("button", { name: mode === "market" ? /market/i : /partial/i })
    .first()
    .click({ timeout: TERMINAL_MS });
  if (mode === "partial" && amount !== undefined) {
    await typeAmount(page, "receive-send", amount);
  }
  await page
    .getByRole("button", { name: /confirm|submit|send/i })
    .first()
    .click({ timeout: TERMINAL_MS });
  await expect(page.locator("div.toast")).toBeVisible({ timeout: TERMINAL_MS });
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
  const dialogText = await openDetailDialog(page, address, TERMINAL_MS);
  const expectedUsd = dec(readString(opened, "asset_value_usd")).toString(2);
  assertNonZeroBasis({ value: expectedUsd, description: `${side} lease value` });
  expect(dialogText).toContain(oracleSize(opened, side));
  const renderedUsd = firstUsdAmount(dialogText);
  if (renderedUsd !== undefined) {
    assertWithinTolerance(
      { actual: renderedUsd, expected: expectedUsd, tolerance: run.usdTolerance },
      `${side} lease rendered value vs oracle`
    );
  }

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

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test.afterAll(async () => {
  if (run.ctx.dispatcher !== undefined) await run.ctx.dispatcher.close();
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

  const protocol = await firstProtocol(run.ctx);
  const floorUsd = resolveDownpaymentFloorUsd(await leaseConfig(run.ctx, protocol));
  const downpayment = floorUsd.add(Decimal.fromString("2")).toString(2);
  const requiredMicro = BigInt(toMicroAmount(downpayment, USDC_DECIMALS));
  const balance = await microBalanceByDenom(run.ctx, wallet.address, "usdc");
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    balance > requiredMicro,
    `primary holds ${balance.toString()} micro-USDC, below the ${requiredMicro.toString()} a ${side} lease needs`
  );

  await connectFlow(page, run, `/positions/open/${side}`);
  await typeAmount(page, "receive-send", downpayment);
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-lease",
    action: "lease-open",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "usdc", micro: requiredMicro }],
    denoms: [{ denom: USDC_DENOM, micro: requiredMicro.toString() }],
    execute: () => submitForm(page, { submitLabel: messageValue(run.locale, "open-position"), terminalMs: TERMINAL_MS })
  });

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
