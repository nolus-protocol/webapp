import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_RESULTS_DIR } from "../config.js";
import { parseRecords } from "../t3/journal.js";
import { JOURNAL_FILE_NAME, REPORT_FILE_NAME } from "../t3/journalStore.js";
import type { LeftoverReport } from "../t3/report.js";
import type { CoverageMatrix } from "../matrix/check.js";
import { e2eRoot } from "../matrix/run.js";
import { aggregate } from "./aggregate.js";
import type {
  AggregateInput,
  JournalInput,
  LeftoverInput,
  MatrixInput,
  SummaryFailure,
  TierSource
} from "./aggregate.js";
import { renderMarkdown } from "./render.js";
import { makeScrubber } from "./scrub.js";
import { AlertDeliveryError, postAlert } from "./alert.js";
import type { AlertFetch } from "./alert.js";

// Thin fs/network glue for the pure report modules; coverage-excluded (see vitest.config.ts).
// It reads the tier result files, folds them through the pure aggregator, writes report.json +
// report.md, posts the alert, and maps the outcome to an exit code: 0 green, 1 red, 2 alert
// delivery/config failure.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function playwrightSource(path: string): TierSource {
  const text = readText(path);
  if (text === null) {
    return { kind: "absent" };
  }
  try {
    return { kind: "playwright", report: JSON.parse(text) };
  } catch {
    return { kind: "corrupt" };
  }
}

function summaryFailures(checks: unknown): SummaryFailure[] {
  if (!Array.isArray(checks)) {
    return [];
  }
  return checks
    .filter(isRecord)
    .filter((check) => check.status === "fail")
    .map((check) => ({ test: stringField(check.title) || stringField(check.id), detail: stringField(check.reason) }));
}

function summarySource(path: string): TierSource {
  const text = readText(path);
  if (text === null) {
    return { kind: "absent" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "corrupt" };
  }
  if (!isRecord(parsed)) {
    return { kind: "corrupt" };
  }
  const summary = isRecord(parsed.summary) ? parsed.summary : {};
  return {
    kind: "summary",
    passed: numberField(summary.pass),
    skipped: numberField(summary.skip),
    failures: summaryFailures(parsed.checks)
  };
}

function isLeftoverReport(value: unknown): value is LeftoverReport {
  return (
    isRecord(value) &&
    value.suite === "t3" &&
    typeof value.terminal === "string" &&
    Array.isArray(value.openLeases) &&
    Array.isArray(value.pendingUnbondings) &&
    Array.isArray(value.unfinishedSwaps) &&
    Array.isArray(value.spend) &&
    Array.isArray(value.warnings)
  );
}

function leftoverInput(path: string): LeftoverInput {
  const text = readText(path);
  if (text === null) {
    return { kind: "absent" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "corrupt" };
  }
  return isLeftoverReport(parsed) ? { kind: "present", report: parsed } : { kind: "corrupt" };
}

function isCoverageMatrix(value: unknown): value is CoverageMatrix {
  return (
    isRecord(value) &&
    Array.isArray(value.routes) &&
    Array.isArray(value.components) &&
    Array.isArray(value.states) &&
    Array.isArray(value.cells)
  );
}

function matrixInput(): MatrixInput {
  const text = readText(join(e2eRoot(), "coverage-matrix.json"));
  if (text === null) {
    return { kind: "absent" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "corrupt" };
  }
  return isCoverageMatrix(parsed) ? { kind: "present", matrix: parsed } : { kind: "corrupt" };
}

function journalInput(path: string): JournalInput {
  const text = readText(path);
  return text === null ? { kind: "absent" } : { kind: "present", records: parseRecords(text) };
}

function redactValues(): string[] {
  return [process.env.E2E_SCRUB_VALUE, process.env.E2E_WALLET_MNEMONIC, process.env.E2E_WALLET_MNEMONIC_2]
    .map((value) => value ?? "")
    .filter((value) => value.length > 0);
}

function buildInput(resultsDir: string, redact: readonly string[]): AggregateInput {
  return {
    generatedAt: new Date().toISOString(),
    tiers: [
      { tier: "t0", source: summarySource(join(resultsDir, "t0.json")) },
      { tier: "t1", source: playwrightSource(join(resultsDir, "playwright-report.json")) },
      { tier: "t2", source: playwrightSource(join(resultsDir, "t2.json")) },
      { tier: "t3-engine", source: playwrightSource(join(resultsDir, "t3-engine.json")) },
      { tier: "t3-flows", source: playwrightSource(join(resultsDir, "t3-flows.json")) }
    ],
    journal: journalInput(join(resultsDir, JOURNAL_FILE_NAME)),
    leftover: leftoverInput(join(resultsDir, REPORT_FILE_NAME)),
    matrix: matrixInput(),
    redactValues: redact
  };
}

const httpFetch: AlertFetch = async (url, request) => {
  const response = await fetch(url, request);
  return { ok: response.ok, status: response.status };
};

async function run(): Promise<number> {
  const resultsDir = resolve(process.env.E2E_RESULTS_DIR?.trim() ?? DEFAULT_RESULTS_DIR);
  const redact = redactValues();
  const scrub = makeScrubber(redact);
  const report = aggregate(buildInput(resultsDir, redact), scrub);
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(join(resultsDir, "report.md"), renderMarkdown(report, scrub), "utf8");
  try {
    const result = await postAlert(report, { webhookUrl: process.env.E2E_ALERT_WEBHOOK, fetchImpl: httpFetch, scrub });
    process.stdout.write(result.posted ? `alert posted (${result.urgency})\n` : "alert: green run, no post\n");
  } catch (error) {
    process.stderr.write(`${error instanceof AlertDeliveryError ? error.message : "alert delivery failed"}\n`);
    return 2;
  }
  return report.failures.length > 0 ? 1 : 0;
}

try {
  process.exit(await run());
} catch (error) {
  process.stderr.write(`report cli failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
