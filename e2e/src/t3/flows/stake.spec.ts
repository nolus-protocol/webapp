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
import { typeAmount, requireOrSkip, probeNativeMicroBalance, readString } from "../../t2/matrixHelpers.js";
import { NATIVE_DENOM, NATIVE_DECIMALS, toMicroAmount } from "../../transfer.js";
import { Decimal } from "../../oracle/decimal.js";
import { formatTokenBalance } from "../../oracle/format.js";
import { submitForm } from "./formDriver.js";
import { unbondingEntriesFor } from "./apiReads.js";
import { pickUnbondingValidator, unbondingEntryGate } from "./preconditions.js";
import { readJson } from "../runtime.js";

// Stake delegate / undelegate / redelegate / claim of dust NLS (#283 flow 3). Undelegate is
// precondition-gated on the 7-entry unbonding cap per validator (rotate when near it), redelegate
// runs through the engine's redelegate mutex and is gated on no maturing redelegation, and claim
// is accrual-dependent (skipped below a dust threshold). NLS token amounts (not USD, which is
// vacuous at $0) are what these assert. Matrix label: flow-stake-delegated.

const DUST_NLS = "0.001";
const TERMINAL_MS = 120000;

let run: RunContext;

interface Delegation {
  validatorAddress: string;
  amountMicro: bigint;
}

async function delegations(ctx: RunContext["ctx"], address: string): Promise<Delegation[]> {
  const payload = await readJson(ctx, `${ctx.origin}/api/staking/positions?address=${encodeURIComponent(address)}`);
  const list = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).delegations : [];
  const out: Delegation[] = [];
  if (Array.isArray(list)) {
    for (const entry of list) {
      const validatorAddress = readString(entry, "validator_address");
      const amount = readString(entry, "balance") ?? readString(entry, "amount");
      if (validatorAddress !== undefined && amount !== undefined && /^\d+$/.test(amount)) {
        out.push({ validatorAddress, amountMicro: BigInt(amount) });
      }
    }
  }
  return out;
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
  const renderedAmount = formatTokenBalance(Decimal.fromAtomics(total.toString(), NATIVE_DECIMALS));
  const stakeText = await page.locator("#app").innerText();
  expect(stakeText).toContain(renderedAmount);

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
  const payload = await readJson(ctx, `${ctx.origin}/api/staking/positions?address=${encodeURIComponent(address)}`);
  const list = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).redelegation : [];
  return Array.isArray(list) ? list.length : 0;
}

test("stake redelegate runs through the engine redelegate mutex, gated on no maturing redelegation", async ({
  page,
  budget,
  wallet
}, testInfo) => {
  skipIfHalted(testInfo, run);
  test.setTimeout(TERMINAL_MS * 2);
  budget.route = "/stake";

  const delegated = await delegations(run.ctx, wallet.address);
  requireOrSkip(testInfo, run.matrix.expectFunded, delegated.length > 0, "no delegation to redelegate");
  const maturing = await maturingRedelegationCount(run.ctx, wallet.address);
  if (maturing > 0) {
    annotateSkipAndStop(testInfo, "precondition", "a redelegation is still maturing; a second is locked");
  }
  const source = delegated[0]?.validatorAddress ?? "";
  expect(source).not.toBe("");

  await connectFlow(page, run, "/stake");
  const requiredMicro = BigInt(toMicroAmount(DUST_NLS, NATIVE_DECIMALS));
  await spendCommittedOrSkip(testInfo, run, {
    spec: "t3-flow-stake",
    action: "redelegate",
    walletRole: "primary",
    walletKey: run.primary.key,
    items: [{ denom: "nls", micro: 0n }],
    denoms: [{ denom: NATIVE_DENOM, micro: requiredMicro.toString() }],
    memo: `redelegate from ${source}`,
    execute: async () => {
      await page
        .getByRole("button", { name: /redelegate/i })
        .first()
        .click({ timeout: TERMINAL_MS });
      await typeAmount(page, "receive-send", DUST_NLS);
      await submitForm(page, { submitLabel: messageValue(run.locale, "redelegate"), terminalMs: TERMINAL_MS });
    }
  });

  reportLeftover(run, testInfo, { terminal: "success" });
});

async function accruedRewardMicro(ctx: RunContext["ctx"], address: string): Promise<bigint> {
  const payload = await readJson(ctx, `${ctx.origin}/api/staking/positions?address=${encodeURIComponent(address)}`);
  const rewards = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>).rewards : [];
  let total = 0n;
  if (Array.isArray(rewards)) {
    for (const entry of rewards) {
      const amount = readString(entry, "amount") ?? readString(entry, "balance");
      if (amount !== undefined && /^\d+$/.test(amount)) total += BigInt(amount);
    }
  }
  return total;
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
