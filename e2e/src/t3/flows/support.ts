import type { Page, TestInfo } from "@playwright/test";
import { test as t2Test, expect } from "../../t2/support.js";
import type { OriginContext, ConnectLabels } from "../../t2/appDriver.js";
import {
  resolveOrigin,
  fetchLocale,
  readConnectLabels,
  connectKeplr,
  waitForAppShell,
  assertConnected
} from "../../t2/appDriver.js";
import { readString } from "../../t2/matrixHelpers.js";
import { parseT2Config, parseMatrixConfig, parseT3Config, DEFAULT_USD_TOLERANCE } from "../../config.js";
import type { T3Config, MatrixConfig } from "../../config.js";
import { createWalletIdentity } from "../../signer.js";
import { SerialQueue } from "../serialQueue.js";
import { spendCapFromMicros } from "../spendCap.js";
import type { SpendItem, SpendCap } from "../spendCap.js";
import { TxEngine } from "../engine.js";
import type { SpendOutcome, WalletRoleConfig } from "../engine.js";
import { JournalStore } from "../journalStore.js";
import { buildIntent, buildOutcome } from "../journal.js";
import type { DenomAmount, IntentAction, WalletRole } from "../journal.js";
import { classify } from "../taxonomy.js";
import type { FailureCategory } from "../taxonomy.js";
import { readJson } from "../runtime.js";
import { writeReportFile } from "../journalStore.js";
import type { OpenLease, PendingUnbonding, TerminalPath } from "../report.js";
import { seqAllocatorFromJournal } from "./seq.js";
import type { SeqAllocator } from "./seq.js";
import { dayOfYearUtc, resolveLeaseSideSetting, resolveLeaseSides } from "./sideSelection.js";
import type { LeaseSide } from "./sideSelection.js";

export { expect };

/** The t2 fixture (scripted Keplr stub + budget) is reused verbatim; the engine is the singleton. */
export const test = t2Test;

const SKIP_ANNOTATION = "t3-flow-skip";
const LEFTOVER_ANNOTATION = "t3-flow-leftover";

export interface ChainSettings {
  rpcUrl: string;
  gasPrice: string;
}

/**
 * The single value-moving substrate shared by every flow spec. Because the project runs with
 * `--workers=1`, one worker process holds one module instance, so this really is one TxEngine,
 * one SpendCap, one SerialQueue, one JournalStore and one seq allocator for the whole run — the
 * only arrangement under which the per-run operator spend cap is meaningful.
 */
export interface RunContext {
  ctx: OriginContext;
  engine: TxEngine;
  cap: SpendCap;
  queue: SerialQueue;
  store: JournalStore;
  seq: SeqAllocator;
  primary: WalletRoleConfig;
  secondary: WalletRoleConfig;
  primaryMnemonic: string;
  secondaryMnemonic: string;
  chain: ChainSettings;
  t3: T3Config;
  matrix: MatrixConfig;
  locale: unknown;
  labels: ConnectLabels;
  usdTolerance: string;
  leaseSides: LeaseSide[];
}

let runContext: RunContext | undefined;

async function resolveChain(ctx: OriginContext, matrixRpc: string | undefined): Promise<ChainSettings> {
  const config = await readJson(ctx, `${ctx.origin}/api/config`);
  const networks =
    typeof config === "object" && config !== null ? (config as Record<string, unknown>).networks : undefined;
  const list: unknown[] = Array.isArray(networks) ? (networks as unknown[]) : [];
  const nolus = list.find((n) => readString(n, "prefix") === "nolus" || readString(n, "key") === "NOLUS");
  const rpcUrl = matrixRpc ?? readString(nolus, "rpc_url");
  if (rpcUrl === undefined) {
    throw new Error("could not resolve the Nolus chain rpc_url from /api/config or E2E_CHAIN_RPC");
  }
  const gasPriceRaw = readString(nolus, "gas_price");
  if (gasPriceRaw === undefined) {
    throw new Error("could not resolve the Nolus gas_price from /api/config");
  }
  const gasPrice = gasPriceRaw.replace(/[^0-9.]/g, "");
  if (gasPrice === "") {
    throw new Error(`Nolus gas_price from /api/config is unparseable: "${gasPriceRaw}"`);
  }
  return { rpcUrl, gasPrice };
}

/**
 * Build (or return the already-built) run singleton. The first call resolves config, derives both
 * wallet identities, reads the live chain settings, and constructs the engine bound to the shared
 * queue/cap/store; every later call returns the same instance so halt state and cumulative spend
 * carry across specs.
 */
interface FlowConfig {
  t2: { primaryMnemonic: string; secondaryMnemonic: string };
  t3: T3Config;
  matrix: MatrixConfig;
  leaseSetting: LeaseSide | "both" | undefined;
}

function parseFlowConfig(): FlowConfig {
  const t2 = parseT2Config(process.env);
  if (!t2.ok) throw new Error(`T2 config error: ${t2.errors.join("; ")}`);
  const parsedT3 = parseT3Config(process.env);
  if (!parsedT3.ok) throw new Error(`T3 config error: ${parsedT3.errors.join("; ")}`);
  const matrix = parseMatrixConfig(process.env);
  if (!matrix.ok) throw new Error(`matrix config error: ${matrix.errors.join("; ")}`);
  const side = resolveLeaseSideSetting(process.env.E2E_LEASE_SIDE);
  if (!side.ok) throw new Error(side.error);
  return { t2: t2.config, t3: parsedT3.config, matrix: matrix.config, leaseSetting: side.setting };
}

async function deriveRoles(t2: FlowConfig["t2"]): Promise<{ primary: WalletRoleConfig; secondary: WalletRoleConfig }> {
  return {
    primary: { role: "primary", key: "primary", address: (await createWalletIdentity(t2.primaryMnemonic)).address },
    secondary: {
      role: "secondary",
      key: "secondary",
      address: (await createWalletIdentity(t2.secondaryMnemonic)).address
    }
  };
}

function constructEngine(
  deps: { queue: SerialQueue; cap: SpendCap },
  roles: { primary: WalletRoleConfig; secondary: WalletRoleConfig },
  t3: T3Config,
  testInfo: TestInfo
): TxEngine {
  return new TxEngine(deps, {
    primary: roles.primary,
    secondary: roles.secondary,
    workers: testInfo.config.workers,
    retries: testInfo.project.retries,
    wallet2LowWaterMicro: BigInt(t3.wallet2LowWaterMicro)
  });
}

export async function getRunContext(testInfo: TestInfo): Promise<RunContext> {
  if (runContext !== undefined) {
    return runContext;
  }
  const ctx = resolveOrigin();
  const config = parseFlowConfig();
  const roles = await deriveRoles(config.t2);
  const chain = await resolveChain(ctx, config.matrix.chainRpc);
  const locale = await fetchLocale(ctx);
  const queue = new SerialQueue();
  const cap = spendCapFromMicros({ nlsMicro: config.t3.spendCapNlsMicro, usdcMicro: config.t3.spendCapUsdcMicro });
  const store = new JournalStore(config.t3.resultsDir);

  runContext = {
    ctx,
    engine: constructEngine({ queue, cap }, roles, config.t3, testInfo),
    cap,
    queue,
    store,
    seq: seqAllocatorFromJournal(store.readAll()),
    primary: roles.primary,
    secondary: roles.secondary,
    primaryMnemonic: config.t2.primaryMnemonic,
    secondaryMnemonic: config.t2.secondaryMnemonic,
    chain,
    t3: config.t3,
    matrix: config.matrix,
    locale,
    labels: readConnectLabels(locale),
    usdTolerance: process.env.E2E_USD_TOLERANCE?.trim() || DEFAULT_USD_TOLERANCE,
    leaseSides: resolveLeaseSides(config.leaseSetting, dayOfYearUtc(new Date()))
  };
  return runContext;
}

/** Reset the singleton — test-support only, called between the worker's specs is never needed. */
export function resetRunContext(): void {
  runContext = undefined;
}

/** Record a machine-readable skip and abort the current test as skipped (never a red). */
export function annotateSkipAndStop(testInfo: TestInfo, category: FailureCategory, reason: string): void {
  testInfo.annotations.push({ type: SKIP_ANNOTATION, description: `${category}: ${reason}` });
  testInfo.skip(true, reason);
}

/**
 * A spend-cap abort halts the engine; every later value-moving spec must skip cleanly rather than
 * cascade EngineHaltedError reds. Call at the top of each value-moving test — returns true (after
 * annotating + skipping) when the engine is already halted.
 */
export function skipIfHalted(testInfo: TestInfo, run: RunContext): void {
  if (run.engine.halted) {
    annotateSkipAndStop(testInfo, "precondition", `engine halted (${run.engine.reason ?? "unknown"})`);
  }
}

/**
 * Classify a caught flow error and route it: an `environment` or `precondition` failure is a
 * clean skip (an operator/liquidity/timing state, never an app bug), while an `app` failure is
 * re-thrown as a red. Always terminates the test — it never returns normally.
 */
export function classifyAndRoute(testInfo: TestInfo, error: unknown, rpcUrl: string): never {
  const classification = classify({ error, rpcUrl });
  if (classification.category === "app") {
    throw error instanceof Error ? error : new Error(String(error));
  }
  annotateSkipAndStop(testInfo, classification.category, `${classification.signal}: ${classification.reason}`);
  throw new Error("unreachable");
}

export interface JournaledSpendParams<T> {
  spec: string;
  action: IntentAction;
  walletRole: WalletRole;
  walletKey: string;
  items: SpendItem[];
  denoms: DenomAmount[];
  counterparty?: boolean;
  memo?: string;
  outcomeFrom?: (value: T) => { txHash?: string; height?: number };
  execute: () => Promise<T>;
}

/**
 * Run one governed spend through the engine with the full journal contract: a write-ahead intent
 * before the broadcast, then a committed / aborted / failed outcome. A spend-cap abort is
 * journaled as `aborted` and returned (the caller skips the remaining flow); a thrown broadcast
 * error is journaled as `failed` with a classified, sanitized reason and re-thrown.
 */
function appendSettled<T>(
  run: RunContext,
  seq: number,
  outcome: SpendOutcome<T>,
  params: JournaledSpendParams<T>
): void {
  if (outcome.status === "committed") {
    const extra = params.outcomeFrom?.(outcome.value) ?? {};
    run.store.append(buildOutcome({ seq, ts: new Date().toISOString(), status: "committed", ...extra }));
    return;
  }
  run.store.append(
    buildOutcome({
      seq,
      ts: new Date().toISOString(),
      status: "aborted",
      failure: classify({ message: `spend-cap-abort on ${outcome.check.overDenom}`, rpcUrl: run.chain.rpcUrl })
    })
  );
}

export async function journaledSpend<T>(run: RunContext, params: JournaledSpendParams<T>): Promise<SpendOutcome<T>> {
  const seq = run.seq.next();
  run.store.append(
    buildIntent({
      seq,
      ts: new Date().toISOString(),
      spec: params.spec,
      walletRole: params.walletRole,
      action: params.action,
      denoms: params.denoms,
      ...(params.memo !== undefined ? { memo: params.memo } : {})
    })
  );
  const request = { walletKey: params.walletKey, action: params.action, items: params.items, execute: params.execute };
  try {
    const outcome = params.counterparty ? await run.engine.counterpartySend(request) : await run.engine.spend(request);
    appendSettled(run, seq, outcome, params);
    return outcome;
  } catch (error) {
    run.store.append(
      buildOutcome({
        seq,
        ts: new Date().toISOString(),
        status: "failed",
        failure: classify({ error, rpcUrl: run.chain.rpcUrl })
      })
    );
    throw error;
  }
}

export interface LeftoverInput {
  terminal: TerminalPath;
  openLeases?: OpenLease[];
  pendingUnbondings?: PendingUnbonding[];
  warnings?: string[];
}

/** Write the leftover-state report for a flow's terminal and annotate where it landed. */
export function reportLeftover(run: RunContext, testInfo: TestInfo, input: LeftoverInput): void {
  const report = run.engine.buildReport({
    generatedAt: new Date().toISOString(),
    terminal: input.terminal,
    journal: run.store.readAll(),
    openLeases: input.openLeases ?? [],
    pendingUnbondings: input.pendingUnbondings ?? [],
    warnings: input.warnings ?? []
  });
  const path = writeReportFile(run.t3.resultsDir, report);
  testInfo.annotations.push({
    type: LEFTOVER_ANNOTATION,
    description: `terminal=${input.terminal} report=${path} openLeases=${report.openLeases.length}`
  });
}

/** Connect the primary wallet on a light route and land on `path`, reusing the t2 app-driver. */
export async function connectFlow(page: Page, run: RunContext, path: string): Promise<void> {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await connectKeplr(page, run.labels);
  await assertConnected(page, run.primary.address);
  if (path !== "/assets") {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}
