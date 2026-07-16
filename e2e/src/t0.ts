import { Agent } from "undici";
import type { Dispatcher } from "undici";
import type { LookupFunction } from "node:net";
import { parseConfig } from "./config.js";
import type { Config } from "./config.js";
import { createLookup, createUndiciConnector } from "./resolver.js";
import { runWsRestParity } from "./checks/wsRestParity.js";
import { runTotalsReconcile } from "./checks/totalsReconcile.js";
import { runRateUnitSanity } from "./checks/rateUnitSanity.js";
import { assembleDocument, exitCodeFor, writeDocument } from "./report.js";
import type { CheckResult } from "./types.js";

interface Dispatch {
  dispatcher: Dispatcher | undefined;
  lookup: LookupFunction | undefined;
}

function buildDispatch(overrides: Map<string, string>): Dispatch {
  if (overrides.size === 0) {
    return { dispatcher: undefined, lookup: undefined };
  }
  return {
    dispatcher: new Agent({ connect: createUndiciConnector(overrides) }),
    lookup: createLookup(overrides)
  };
}

async function runAllChecks(config: Config, dispatch: Dispatch): Promise<CheckResult[]> {
  const parity = await runWsRestParity({
    wsUrl: config.wsUrl,
    baseUrl: config.baseUrl,
    address: config.readonlyAddress,
    toleranceUsd: config.usdTolerance,
    pushTimeoutMs: config.wsPushTimeoutMs,
    dispatcher: dispatch.dispatcher,
    lookup: dispatch.lookup
  });
  const totals = await runTotalsReconcile({
    baseUrl: config.baseUrl,
    address: config.readonlyAddress,
    toleranceUsd: config.usdTolerance,
    dispatcher: dispatch.dispatcher
  });
  const rate = await runRateUnitSanity({
    baseUrl: config.baseUrl,
    address: config.readonlyAddress,
    band: { minPercent: config.rateMinPercent, maxPercent: config.rateMaxPercent },
    dispatcher: dispatch.dispatcher
  });
  return [parity, totals, rate];
}

function reportConfigErrors(errors: string[]): void {
  process.stderr.write("E2E T0 configuration errors:\n");
  for (const message of errors) {
    process.stderr.write(`  - ${message}\n`);
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const parsed = parseConfig(process.env);
  if (!parsed.ok) {
    reportConfigErrors(parsed.errors);
    return;
  }

  const config = parsed.config;
  const dispatch = buildDispatch(config.hostOverrides);
  try {
    const startedAt = new Date().toISOString();
    const checks = await runAllChecks(config, dispatch);
    const finishedAt = new Date().toISOString();

    const doc = assembleDocument({
      startedAt,
      finishedAt,
      baseUrl: config.baseUrl,
      address: config.readonlyAddress,
      checks
    });

    const filePath = writeDocument(doc, config.resultsDir);
    process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
    process.stderr.write(`t0 results written to ${filePath}\n`);
    process.exitCode = exitCodeFor(doc);
  } finally {
    if (dispatch.dispatcher !== undefined) {
      await dispatch.dispatcher.close();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`fatal: ${message}\n`);
  process.exitCode = 1;
});
