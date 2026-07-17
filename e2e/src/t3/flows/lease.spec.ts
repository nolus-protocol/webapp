import { test, expect } from "./support.js";
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
import { messageValue } from "../../t2/appDriver.js";
import { typeAmount, requireOrSkip, readString } from "../../t2/matrixHelpers.js";
import { USDC_DECIMALS } from "../../config.js";
import { toMicroAmount } from "../../transfer.js";
import { Decimal } from "../../oracle/decimal.js";
import { computeLiquidation, leaseSizeCell } from "../../oracle/lease.js";
import { microBalanceByDenom, openedLease, leaseConfig, firstProtocol } from "./apiReads.js";
import { submitForm, openDetailDialog } from "./formDriver.js";
import { resolveDownpaymentFloorUsd } from "./preconditions.js";
import type { LeaseSide } from "./sideSelection.js";
import { assertNonZeroBasis } from "./tolerance.js";

// The alternating-side single-lease lifecycle (#283 flow 1). The side is chosen by UTC
// day-of-year parity unless E2E_LEASE_SIDE pins it. USDC is the only viable downpayment denom
// (NLS is priced ~$0 on staging, so its USD figures are vacuous). The whole cycle — open, then
// the leftover-safe teardown — runs on ONE lease within this run so the pre-run sweep never sees
// a cross-run orphan. Post-flow math is asserted against the EXISTING render oracle on the
// non-zero-priced collateral leg. Matrix labels: flow-lease-row, flow-lease-detail,
// flow-lease-crossfield.

const USDC_DENOM = "ibc/usdc";
const TERMINAL_MS = 150000;

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

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test.afterAll(async () => {
  if (run.ctx.dispatcher !== undefined) await run.ctx.dispatcher.close();
});

test("a single alternating-side lease opens and its rendered figures match the oracle", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 3);
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
  try {
    const outcome = await journaledSpend(run, {
      spec: "t3-flow-lease",
      action: "lease-open",
      walletRole: "primary",
      walletKey: run.primary.key,
      items: [{ denom: "usdc", micro: requiredMicro }],
      denoms: [{ denom: USDC_DENOM, micro: requiredMicro.toString() }],
      execute: () =>
        submitForm(page, { submitLabel: messageValue(run.locale, "open-position"), terminalMs: TERMINAL_MS })
    });
    if (outcome.status === "spend-cap-abort") {
      reportLeftover(run, testInfo, { terminal: "spend-cap-abort" });
      annotateSkipAndStop(testInfo, "precondition", `spend cap reached on ${outcome.check.overDenom}`);
    }
  } catch (error) {
    reportLeftover(run, testInfo, { terminal: "app-failure" });
    classifyAndRoute(testInfo, error, run.chain.rpcUrl);
  }

  await page.goto("/positions", { waitUntil: "domcontentloaded" });
  const lease = await openedLease(run.ctx, wallet.address);
  requireOrSkip(testInfo, run.matrix.expectFunded, lease !== undefined, "no opened lease enumerated after open");
  const opened = lease ?? {};
  const address = readString(opened, "address") ?? "";

  testInfo.annotations.push({ type: "matrix", description: "flow-lease-row" });
  await expect(page.getByText(address, { exact: false }).first()).toBeVisible({ timeout: TERMINAL_MS });

  testInfo.annotations.push({ type: "matrix", description: "flow-lease-detail" });
  const dialogText = await openDetailDialog(page, address, TERMINAL_MS);
  const size = oracleSize(opened, side);
  assertNonZeroBasis({
    value: dec(readString(opened, "asset_value_usd")).toString(2),
    description: `${side} lease value`
  });
  expect(dialogText).toContain(size);

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

  reportLeftover(run, testInfo, {
    terminal: "success",
    openLeases: [{ address, protocol: readString(opened, "protocol") ?? protocol, status: "opened" }]
  });
});
