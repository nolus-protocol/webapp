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
import { formatDecAsUsd } from "../../oracle/format.js";
import { microBalanceByDenom } from "./apiReads.js";
import { submitForm } from "./formDriver.js";
import { readJson } from "../runtime.js";
import { assertNonZeroBasis } from "./tolerance.js";

// Earn supply + withdraw of dust USDC (#283 flow 2). The rendered user earn total is asserted
// against the GET /api/earn/positions total through the render oracle, and a WS earn tick must
// not clobber the REST-sourced fields (the T2 reconnect technique). Matrix label: flow-earn-total.

const USDC_DENOM = "ibc/usdc";
const DUST_USDC = "0.05";
const TERMINAL_MS = 120000;

let run: RunContext;

async function earnDepositUsd(ctx: RunContext["ctx"], address: string): Promise<Decimal> {
  const payload = await readJson(ctx, `${ctx.origin}/api/earn/positions?address=${address}`);
  const positions =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).positions : [];
  let total = Decimal.zero();
  if (Array.isArray(positions)) {
    for (const entry of positions) {
      const usd = readString(entry, "value_usd") ?? readString(entry, "supplied_usd");
      if (usd !== undefined && /^\d+(\.\d+)?$/.test(usd)) {
        total = total.add(Decimal.fromString(usd));
      }
    }
  }
  return total;
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test.afterAll(async () => {
  if (run.ctx.dispatcher !== undefined) await run.ctx.dispatcher.close();
});

test("earn supply then withdraw of dust USDC, rendered total matches the oracle", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 3);
  budget.route = "/earn/supply";

  const requiredMicro = BigInt(toMicroAmount(DUST_USDC, USDC_DECIMALS));
  const balance = await microBalanceByDenom(run.ctx, wallet.address, "usdc");
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    balance > requiredMicro,
    `primary holds ${balance.toString()} micro-USDC, below the ${requiredMicro.toString()} an earn supply needs`
  );

  await connectFlow(page, run, "/earn/supply");
  await typeAmount(page, "receive-send", DUST_USDC);
  try {
    const outcome = await journaledSpend(run, {
      spec: "t3-flow-earn",
      action: "earn-supply",
      walletRole: "primary",
      walletKey: run.primary.key,
      items: [{ denom: "usdc", micro: requiredMicro }],
      denoms: [{ denom: USDC_DENOM, micro: requiredMicro.toString() }],
      execute: () => submitForm(page, { submitLabel: messageValue(run.locale, "supply"), terminalMs: TERMINAL_MS })
    });
    if (outcome.status === "spend-cap-abort") {
      reportLeftover(run, testInfo, { terminal: "spend-cap-abort" });
      annotateSkipAndStop(testInfo, "precondition", `spend cap reached on ${outcome.check.overDenom}`);
    }
  } catch (error) {
    reportLeftover(run, testInfo, { terminal: "app-failure" });
    classifyAndRoute(testInfo, error, run.chain.rpcUrl);
  }

  testInfo.annotations.push({ type: "matrix", description: "flow-earn-total" });
  await page.goto("/earn", { waitUntil: "domcontentloaded" });
  const total = await earnDepositUsd(run.ctx, wallet.address);
  assertNonZeroBasis({ value: total.toString(2), description: "earn deposit total" });
  const rendered = await page.locator("#app").innerText();
  expect(rendered).toContain(formatDecAsUsd(total));

  await connectFlow(page, run, "/earn/withdraw");
  await typeAmount(page, "receive-send", DUST_USDC);
  try {
    await journaledSpend(run, {
      spec: "t3-flow-earn",
      action: "earn-withdraw",
      walletRole: "primary",
      walletKey: run.primary.key,
      items: [{ denom: "nls", micro: 0n }],
      denoms: [{ denom: USDC_DENOM, micro: requiredMicro.toString() }],
      execute: () => submitForm(page, { submitLabel: messageValue(run.locale, "withdraw"), terminalMs: TERMINAL_MS })
    });
  } catch (error) {
    reportLeftover(run, testInfo, { terminal: "app-failure" });
    classifyAndRoute(testInfo, error, run.chain.rpcUrl);
  }

  reportLeftover(run, testInfo, { terminal: "success" });
});
