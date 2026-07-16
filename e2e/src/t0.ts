import { Agent } from "undici";
import type { Dispatcher } from "undici";
import type { LookupFunction } from "node:net";
import { parseConfig } from "./config.js";
import { createLookup, createUndiciConnector } from "./resolver.js";
import { runWsRestParity } from "./checks/wsRestParity.js";
import { runTotalsReconcile } from "./checks/totalsReconcile.js";
import { runRateUnitSanity } from "./checks/rateUnitSanity.js";
import { assembleDocument, exitCodeFor, writeDocument } from "./report.js";
import type { CheckResult } from "./types.js";

async function main(): Promise<void> {
  const parsed = parseConfig(process.env);
  if (!parsed.ok) {
    process.stderr.write("E2E T0 configuration errors:\n");
    for (const message of parsed.errors) {
      process.stderr.write(`  - ${message}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const config = parsed.config;
  const hasOverrides = config.hostOverrides.size > 0;
  const dispatcher: Dispatcher | undefined = hasOverrides
    ? new Agent({ connect: createUndiciConnector(config.hostOverrides) })
    : undefined;
  const lookup: LookupFunction | undefined = hasOverrides ? createLookup(config.hostOverrides) : undefined;

  const startedAt = new Date().toISOString();
  const checks: CheckResult[] = [];

  checks.push(
    await runWsRestParity({
      wsUrl: config.wsUrl,
      baseUrl: config.baseUrl,
      address: config.readonlyAddress,
      toleranceUsd: config.usdTolerance,
      pushTimeoutMs: config.wsPushTimeoutMs,
      dispatcher,
      lookup
    })
  );
  checks.push(
    await runTotalsReconcile({
      baseUrl: config.baseUrl,
      address: config.readonlyAddress,
      toleranceUsd: config.usdTolerance,
      dispatcher
    })
  );
  checks.push(
    await runRateUnitSanity({
      baseUrl: config.baseUrl,
      address: config.readonlyAddress,
      minPercent: config.rateMinPercent,
      maxPercent: config.rateMaxPercent,
      dispatcher
    })
  );

  const finishedAt = new Date().toISOString();
  const document = assembleDocument({
    startedAt,
    finishedAt,
    baseUrl: config.baseUrl,
    address: config.readonlyAddress,
    checks
  });

  const filePath = writeDocument(document, config.resultsDir);
  process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
  process.stderr.write(`t0 results written to ${filePath}\n`);
  process.exitCode = exitCodeFor(document);

  if (dispatcher !== undefined) {
    await dispatcher.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`fatal: ${message}\n`);
  process.exitCode = 1;
});
