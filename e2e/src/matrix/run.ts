/**
 * Disk-backed matrix runner: loads `coverage-matrix.json` and validates every cell against
 * the real spec files. Used by both the vitest integration test and the CI guard CLI.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMatrix } from "./check.js";
import type { CheckResult, CoverageMatrix } from "./check.js";

/** The e2e package root (this file is at `<e2e>/src/matrix/run.ts`). */
export function e2eRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function loadMatrix(): CoverageMatrix {
  return JSON.parse(readFileSync(join(e2eRoot(), "coverage-matrix.json"), "utf8")) as CoverageMatrix;
}

export function runMatrixCheck(): CheckResult {
  const matrix = loadMatrix();
  return checkMatrix(matrix, (relative) => readFileSync(join(e2eRoot(), relative), "utf8"));
}
