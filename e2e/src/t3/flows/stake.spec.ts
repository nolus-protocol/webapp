import { test, expect } from "./support.js";
import type { RunContext } from "./support.js";
import {
  getRunContext,
  connectFlow,
  reportLeftover,
  skipIfHalted,
  annotateSkipAndStop,
  spendCommittedOrSkip
} from "./support.js";
import { messageValue } from "../../t2/appDriver.js";
import { typeAmount, requireOrSkip, probeNativeMicroBalance } from "../../t2/matrixHelpers.js";
import { NATIVE_DENOM, NATIVE_DECIMALS, toMicroAmount } from "../../transfer.js";
import { Decimal } from "../../oracle/decimal.js";
import { formatTokenBalance } from "../../oracle/format.js";
import { submitForm, waitForAmountAccepted, clickLocatorAndSettle } from "./formDriver.js";
import { findAnimatedFigure } from "./renderFigure.js";
import { unbondingEntriesFor } from "./apiReads.js";
import { pickUnbondingValidator, unbondingEntryGate } from "./preconditions.js";
import {
  parseDelegations,
  parseAccruedRewardMicro,
  parseMaturingRedelegationCount,
  parseJailedValidators
} from "./staking.js";
import type { Delegation } from "./staking.js";
import { readJson } from "../runtime.js";

// Stake delegate / undelegate / redelegate / claim of dust NLS (#283 flow 3). Undelegate is
// precondition-gated on the 7-entry unbonding cap per validator (rotate when near it), redelegate
// runs through the engine's redelegate mutex and is gated on no maturing redelegation, and claim
// is accrual-dependent (skipped below a dust threshold). NLS token amounts (not USD, which is
// vacuous at $0) are what these assert. Matrix label: flow-stake-delegated.

const DUST_NLS = "0.001";
const TERMINAL_MS = 120000;

let run: RunContext;

async function stakingPositions(ctx: RunContext["ctx"], address: string): Promise<unknown> {
  return readJson(ctx, `${ctx.origin}/api/staking/positions?address=${encodeURIComponent(address)}`);
}

async function delegations(ctx: RunContext["ctx"], address: string): Promise<Delegation[]> {
  return parseDelegations(await stakingPositions(ctx, address));
}

test.beforeAll(async () => {
  run = await getRunContext(test.info());
});

test("stake delegate of dust NLS renders the delegated amount matching the oracle", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/stake/delegate";

  const requiredMicro = BigInt(toMicroAmount(DUST_NLS, NATIVE_DECIMALS));
  const balance = await probeNativeMicroBalance(run.ctx, wallet.address);
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    balance > requiredMicro,
    `primary holds ${balance.toString()} micro-NLS, below the ${requiredMicro.toString()} a delegation needs`
  );

  await connectFlow(page, run, "/stake/delegate");
  await typeAmount(page, "receive-send", DUST_NLS);
  await waitForAmountAccepted(page);
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-stake",
    action: "delegate",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: requiredMicro }],
    denoms: [{ denom: NATIVE_DENOM, micro: requiredMicro.toString() }],
    execute: () => submitForm(page, { submitLabel: messageValue(run.locale, "delegate"), terminalMs: TERMINAL_MS })
  });

  testInfo.annotations.push({ type: "matrix", description: "flow-stake-delegated" });
  await page.goto("/stake", { waitUntil: "domcontentloaded" });
  const delegated = await delegations(run.ctx, wallet.address);
  const total = delegated.reduce((sum, d) => sum + d.amountMicro, 0n);
  requireOrSkip(testInfo, run.matrix.expectFunded, total > 0n, "no delegation enumerated after delegate");
  // The staked total renders via AnimateNumber — the true value is in the aria-label, not innerText.
  const renderedAmount = formatTokenBalance(Decimal.fromAtomics(total.toString(), NATIVE_DECIMALS));
  expect(await findAnimatedFigure(page.locator("#app"), renderedAmount, TERMINAL_MS)).toBe(true);

  reportLeftover(run, testInfo, { terminal: "success" });
});

test("stake undelegate is precondition-gated on the per-validator unbonding-entry cap", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/stake/undelegate";

  const delegated = await delegations(run.ctx, wallet.address);
  requireOrSkip(testInfo, run.matrix.expectFunded, delegated.length > 0, "no delegation to undelegate");
  const candidates = await Promise.all(
    delegated.map(async (d) => ({
      validatorAddress: d.validatorAddress,
      entries: await unbondingEntriesFor(run.ctx, wallet.address, d.validatorAddress)
    }))
  );
  const target = pickUnbondingValidator(candidates);
  if (target === undefined) {
    annotateSkipAndStop(testInfo, "precondition", "every candidate validator is at the unbonding-entry cap");
  }
  const gate = unbondingEntryGate(candidates.find((c) => c.validatorAddress === target)?.entries ?? 0);
  expect(gate.ok).toBe(true);

  await connectFlow(page, run, "/stake/undelegate");
  await typeAmount(page, "receive-send", DUST_NLS);
  await waitForAmountAccepted(page);
  const requiredMicro = BigInt(toMicroAmount(DUST_NLS, NATIVE_DECIMALS));
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-stake",
    action: "undelegate",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: NATIVE_DENOM, micro: requiredMicro.toString() }],
    memo: `undelegate target ${target}`,
    execute: () => submitForm(page, { submitLabel: messageValue(run.locale, "undelegate"), terminalMs: TERMINAL_MS })
  });

  reportLeftover(run, testInfo, {
    terminal: "success",
    warnings: ["undelegation enters a 21-day unbonding window; the entry is expected leftover state"]
  });
});

async function maturingRedelegationCount(ctx: RunContext["ctx"], address: string): Promise<number> {
  return parseMaturingRedelegationCount(await stakingPositions(ctx, address));
}

async function jailedValidators(ctx: RunContext["ctx"]): Promise<Set<string>> {
  return parseJailedValidators(await readJson(ctx, `${ctx.origin}/api/staking/validators`));
}

test("stake redelegate recovers a jailed-validator delegation through the engine redelegate mutex", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/stake";

  // The RedelegateButton renders ONLY on a jailed-validator row (redelegate is the jailed-recovery
  // action), so this is gated on the wallet holding a delegation to a jailed validator.
  const delegated = await delegations(run.ctx, wallet.address);
  requireOrSkip(testInfo, run.matrix.expectFunded, delegated.length > 0, "no delegation to redelegate");
  const jailed = await jailedValidators(run.ctx);
  const source = delegated.find((d) => jailed.has(d.validatorAddress))?.validatorAddress;
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    source !== undefined,
    "no delegation to a jailed validator to redelegate"
  );
  const maturing = await maturingRedelegationCount(run.ctx, wallet.address);
  if (maturing > 0) {
    annotateSkipAndStop(testInfo, "precondition", "a redelegation is still maturing; a second is locked");
  }

  await connectFlow(page, run, "/stake");
  const requiredMicro = BigInt(toMicroAmount(DUST_NLS, NATIVE_DECIMALS));
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-stake",
    action: "redelegate",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: NATIVE_DENOM, micro: requiredMicro.toString() }],
    memo: `redelegate from ${source ?? ""}`,
    // The control is an unnamed refresh SvgIcon on the jailed row (its /redelegate/ text is only in
    // a tooltip): its click runs walletOperation directly (auto-picks destinations, no dialog).
    execute: () => clickLocatorAndSettle(page, page.locator("svg.cursor-pointer"), "redelegate", TERMINAL_MS)
  });

  reportLeftover(run, testInfo, { terminal: "success" });
});

async function accruedRewardMicro(ctx: RunContext["ctx"], address: string): Promise<bigint> {
  return parseAccruedRewardMicro(await stakingPositions(ctx, address));
}

test("stake claim is tolerance-gated and skips cleanly when accrued rewards are below dust", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/stake";

  const dustMicro = BigInt(toMicroAmount(DUST_NLS, NATIVE_DECIMALS));
  const accrued = await accruedRewardMicro(run.ctx, wallet.address);
  requireOrSkip(
    testInfo,
    run.matrix.expectFunded,
    accrued >= dustMicro,
    "accrued rewards are below the dust threshold"
  );
  expect(accrued >= dustMicro).toBe(true);

  await connectFlow(page, run, "/stake");
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-stake",
    action: "stake-claim",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: NATIVE_DENOM, micro: accrued.toString() }],
    execute: async () => {
      await page.getByRole("button", { name: /claim/i }).first().click({ timeout: TERMINAL_MS });
      await submitForm(page, { submitLabel: messageValue(run.locale, "claim"), terminalMs: TERMINAL_MS });
    }
  });

  reportLeftover(run, testInfo, { terminal: "success" });
});
