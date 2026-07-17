import { test, expect } from "./support.js";
import type { RunContext } from "./support.js";
import { getRunContext, connectFlow, reportLeftover, skipIfHalted, spendCommittedOrSkip } from "./support.js";
import { messageValue } from "../../t2/appDriver.js";
import { typeAmount, requireOrSkip, readString } from "../../t2/matrixHelpers.js";
import { USDC_DECIMALS } from "../../config.js";
import { toMicroAmount } from "../../transfer.js";
import { submitForm } from "./formDriver.js";
import { readJson } from "../runtime.js";
import { USDC_DENOM } from "./denoms.js";

// IBC deposit + withdraw Nolus <-> Osmosis (#283 flow 5). ENTIRELY skip-gated on a funded
// Osmosis-side probe: the whole flow is inert until that funding is confirmed, at which point
// E2E_EXPECT_FUNDED escalates the unmet precondition into a hard failure. The structure is
// complete so a funded run exercises deposit and withdraw end to end. No matrix cell.

const DUST_USDC = "0.05";
const TERMINAL_MS = 150000;

let run: RunContext;

/**
 * Probe whether the Osmosis counterparty side holds funds to relay back. There is no committed
 * Osmosis balance endpoint in this suite, so the probe reports funded only when the operator
 * asserts it via E2E_EXPECT_FUNDED — otherwise the flow skips, never broadcasting an IBC transfer
 * that would strand value with no return leg.
 */
async function osmosisFunded(ctx: RunContext["ctx"], address: string): Promise<boolean> {
  const payload = await readJson(
    ctx,
    `${ctx.origin}/api/balances?address=${encodeURIComponent(address)}&network=osmosis`
  ).catch(() => null);
  const balances = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).balances : [];
  return Array.isArray(balances) && balances.some((entry) => (readString(entry, "amount") ?? "0") !== "0");
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test("IBC deposit then withdraw Nolus <-> Osmosis, gated on a funded Osmosis side", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 3);
  budget.route = "/assets";

  const funded = await osmosisFunded(run.ctx, wallet.address);
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    funded,
    "Osmosis counterparty side is not funded for an IBC round trip"
  );

  const requiredMicro = BigInt(toMicroAmount(DUST_USDC, USDC_DECIMALS));
  await connectFlow(page, run, "/assets");
  // The deposit leg's own cap abort skips the whole test (spendCommittedOrSkip), so the withdraw
  // leg never runs on a halted engine — no EngineHaltedError cascade.
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-ibc",
    action: "ibc-transfer",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "usdc", micro: requiredMicro }],
    denoms: [{ denom: USDC_DENOM, micro: requiredMicro.toString() }],
    memo: "ibc deposit nolus<-osmosis",
    execute: async () => {
      await page
        .getByRole("button", { name: /deposit/i })
        .first()
        .click({ timeout: TERMINAL_MS });
      await typeAmount(page, "receive-send", DUST_USDC);
      await submitForm(page, { submitLabel: messageValue(run.locale, "transfer"), terminalMs: TERMINAL_MS });
    }
  });
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-ibc",
    action: "ibc-transfer",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "usdc", micro: requiredMicro }],
    denoms: [{ denom: USDC_DENOM, micro: requiredMicro.toString() }],
    memo: "ibc withdraw nolus->osmosis",
    execute: async () => {
      await page
        .getByRole("button", { name: /withdraw/i })
        .first()
        .click({ timeout: TERMINAL_MS });
      await typeAmount(page, "receive-send", DUST_USDC);
      await submitForm(page, { submitLabel: messageValue(run.locale, "transfer"), terminalMs: TERMINAL_MS });
    }
  });

  const ibcIntents = run.store
    .readAll()
    .filter((record) => record.type === "intent" && record.action === "ibc-transfer");
  expect(ibcIntents.length).toBeGreaterThanOrEqual(2);
  reportLeftover(run, testInfo, { terminal: "success" });
});
