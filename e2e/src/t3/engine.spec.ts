import { test, expect } from "@playwright/test";
import type { TestInfo } from "@playwright/test";
import { resolveOrigin } from "../t2/appDriver.js";
import type { OriginContext } from "../t2/appDriver.js";
import { parseMatrixConfig, parseT2Config, parseT3Config } from "../config.js";
import type { T3Config } from "../config.js";
import { createWalletIdentity } from "../signer.js";
import { DEFAULT_GAS_LIMIT, NATIVE_DENOM, makeFee, makeSendCoin } from "../transfer.js";
import { broadcastSend } from "../broadcast.js";
import { SerialQueue } from "./serialQueue.js";
import { spendCapFromMicros } from "./spendCap.js";
import { TxEngine } from "./engine.js";
import type { WalletRoleConfig } from "./engine.js";
import { sweep } from "./reconcile.js";
import { pacedSweepDeps, readJson } from "./runtime.js";
import { JournalStore, readAttempts, writeAttempts, writeReportFile } from "./journalStore.js";
import { buildIntent, buildOutcome } from "./journal.js";
import { readString } from "../t2/matrixHelpers.js";

// The T3 engine live smoke (workflow_dispatch only). It proves the engine's three invariants
// against the real target — reconciliation enumerate+report, per-wallet serialization, and the
// pre-sign spend-cap gate — and performs the single operator-approved live broadcast class: a
// dust native send from the primary to wallet-2, governed by the engine and its tiny CI cap.
// why: a fixed settle delay lets the LIVE nginx strict rate bucket refill after the ratelimit
// project this depends on — the bucket lives on the server and cannot be faked or polled from
// here, so a wall-clock wait is the only option; kept small (3s covers the 2 RPS / burst 5 bucket).
const SETTLE_MS = 3000;
const DUST_NLS = "0.001";

interface ChainSettings {
  rpcUrl: string;
  gasPrice: string;
}

let ctx: OriginContext;
let t3: T3Config;
let primary: WalletRoleConfig;
let secondary: WalletRoleConfig;
let primaryMnemonic: string;
let chain: ChainSettings;

async function resolveChain(matrixRpc: string | undefined): Promise<ChainSettings> {
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

function newEngine(testInfo: TestInfo): TxEngine {
  const queue = new SerialQueue();
  const cap = spendCapFromMicros({ nlsMicro: t3.spendCapNlsMicro, usdcMicro: t3.spendCapUsdcMicro });
  return new TxEngine(
    { queue, cap },
    {
      primary,
      secondary,
      workers: testInfo.config.workers,
      retries: testInfo.project.retries,
      wallet2LowWaterMicro: BigInt(t3.wallet2LowWaterMicro)
    }
  );
}

test.beforeAll(async () => {
  ctx = resolveOrigin();
  const t2 = parseT2Config(process.env);
  if (!t2.ok) throw new Error(`T2 config error: ${t2.errors.join("; ")}`);
  const parsedT3 = parseT3Config(process.env);
  if (!parsedT3.ok) throw new Error(`T3 config error: ${parsedT3.errors.join("; ")}`);
  t3 = parsedT3.config;
  primaryMnemonic = t2.config.primaryMnemonic;
  primary = {
    role: "primary",
    key: "primary",
    address: (await createWalletIdentity(t2.config.primaryMnemonic)).address
  };
  secondary = {
    role: "secondary",
    key: "secondary",
    address: (await createWalletIdentity(t2.config.secondaryMnemonic)).address
  };
  const matrix = parseMatrixConfig(process.env);
  if (!matrix.ok) throw new Error(`matrix config error: ${matrix.errors.join("; ")}`);
  chain = await resolveChain(matrix.config.chainRpc);
  await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_MS));
});

test.afterAll(async () => {
  if (ctx.dispatcher !== undefined) await ctx.dispatcher.close();
});

test("reconciliation sweep enumerates leftover state and writes a machine-readable report", async () => {
  const testInfo = test.info();
  const engine = newEngine(testInfo);
  const queue = new SerialQueue();
  const attempts = readAttempts(t3.resultsDir);
  const result = await sweep(pacedSweepDeps(queue, ctx), { origin: ctx.origin, address: primary.address, attempts });
  writeAttempts(t3.resultsDir, result.nextAttempts);

  const report = engine.buildReport({
    generatedAt: new Date().toISOString(),
    terminal: "success",
    journal: new JournalStore(t3.resultsDir).readAll(),
    openLeases: result.openLeases,
    pendingUnbondings: result.pendingUnbondings,
    warnings: []
  });
  const path = writeReportFile(t3.resultsDir, report);
  testInfo.annotations.push({
    type: "t3-report",
    description: `leftover report written (${result.openLeases.length} open lease(s))`
  });
  expect(path).toContain("t3-report.json");
  expect(Array.isArray(report.openLeases)).toBe(true);
});

test("per-wallet submissions serialize: the second starts only after the first commits", async () => {
  const queue = new SerialQueue();
  const order: string[] = [];
  let firstDone = false;
  let releaseFirst: () => void = () => undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const flush = (): Promise<void> =>
    new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

  const p1 = queue.submit({
    walletKey: primary.key,
    kind: "spend",
    execute: async () => {
      order.push("first:start");
      await firstGate;
      firstDone = true;
      order.push("first:commit");
    }
  });
  const p2 = queue.submit({
    walletKey: primary.key,
    kind: "spend",
    execute: () => {
      expect(firstDone).toBe(true);
      order.push("second:start");
      return Promise.resolve();
    }
  });

  await flush();
  expect(order).toEqual(["first:start"]);
  releaseFirst();
  await Promise.all([p1, p2]);
  expect(order).toEqual(["first:start", "first:commit", "second:start"]);
});

test("the spend-cap gate aborts an over-cap candidate before it is ever signed", async () => {
  const testInfo = test.info();
  const engine = newEngine(testInfo);
  let signed = false;
  const nlsCapMicro = BigInt(t3.spendCapNlsMicro);
  const outcome = await engine.spend({
    walletKey: primary.key,
    action: "swap",
    items: [{ denom: "nls", micro: nlsCapMicro + 1n }],
    execute: () => {
      signed = true;
      return Promise.resolve("should-not-run");
    }
  });
  expect(signed).toBe(false);
  expect(outcome.status).toBe("spend-cap-abort");
  expect(engine.halted).toBe(true);
});

test("a dust native send from the primary commits through the engine and is journaled", async () => {
  const testInfo = test.info();
  const engine = newEngine(testInfo);
  const store = new JournalStore(t3.resultsDir);
  const coin = makeSendCoin(DUST_NLS);
  const fee = makeFee(DEFAULT_GAS_LIMIT, chain.gasPrice, NATIVE_DENOM);
  const required = BigInt(coin.amount) + BigInt(fee.amount[0]?.amount ?? "0");
  const balancePayload = await readJson(ctx, `${ctx.origin}/api/balances?address=${primary.address}`);
  const primaryMicro = nativeMicro(balancePayload);
  if (primaryMicro <= required) {
    testInfo.skip(true, "primary is not funded enough for a dust send plus fee");
    return;
  }

  const seq = 1;
  store.append(
    buildIntent({
      seq,
      ts: new Date().toISOString(),
      spec: "t3-engine",
      walletRole: "primary",
      action: "native-send",
      denoms: [{ denom: NATIVE_DENOM, micro: required.toString() }],
      memo: "nolus-e2e-t3",
      rpcUrl: chain.rpcUrl
    })
  );

  const outcome = await engine.spend({
    walletKey: primary.key,
    action: "native-send",
    items: [{ denom: "nls", micro: required }],
    execute: () =>
      broadcastSend({
        rpcUrl: chain.rpcUrl,
        senderMnemonic: primaryMnemonic,
        prefix: "nolus",
        recipient: secondary.address,
        amount: coin,
        fee,
        memo: "nolus-e2e-t3"
      })
  });

  expect(outcome.status).toBe("committed");
  if (outcome.status === "committed") {
    store.append(
      buildOutcome({
        seq,
        ts: new Date().toISOString(),
        status: "committed",
        txHash: outcome.value.txHash,
        height: outcome.value.height,
        rpcUrl: chain.rpcUrl
      })
    );
    testInfo.annotations.push({
      type: "t3-send",
      description: `dust send committed at height ${outcome.value.height}`
    });
  }
});

function nativeMicro(payload: unknown): bigint {
  if (typeof payload !== "object" || payload === null) return 0n;
  const balances = (payload as Record<string, unknown>).balances;
  if (!Array.isArray(balances)) return 0n;
  let total = 0n;
  for (const entry of balances) {
    if (readString(entry, "denom") === NATIVE_DENOM) {
      const amount = readString(entry, "amount");
      if (amount !== undefined) total += BigInt(amount);
    }
  }
  return total;
}
