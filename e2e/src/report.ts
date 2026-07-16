import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_FILE_NAME } from "./config.js";
import type { CheckResult, T0Document } from "./types.js";

export function summarize(checks: CheckResult[]): T0Document["summary"] {
  return {
    pass: checks.filter((check) => check.status === "pass").length,
    fail: checks.filter((check) => check.status === "fail").length,
    skip: checks.filter((check) => check.status === "skip").length
  };
}

export function assembleDocument(input: {
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  address: string;
  checks: CheckResult[];
}): T0Document {
  return {
    suite: "t0",
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    baseUrl: input.baseUrl,
    address: input.address,
    checks: input.checks,
    summary: summarize(input.checks)
  };
}

export function exitCodeFor(document: T0Document): number {
  return document.summary.fail > 0 ? 1 : 0;
}

export function writeDocument(document: T0Document, resultsDir: string): string {
  const directory = resolve(resultsDir);
  mkdirSync(directory, { recursive: true });
  const filePath = resolve(directory, RESULTS_FILE_NAME);
  writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return filePath;
}
