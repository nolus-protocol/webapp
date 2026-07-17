import type { JournalRecord } from "../t3/journal.js";
import { isIntent, isOutcome, unmatchedIntents } from "../t3/journal.js";
import type { LeftoverReport } from "../t3/report.js";
import type { Cell, CoverageMatrix } from "../matrix/check.js";
import type { RunTest } from "./playwright.js";
import { extractRunTests } from "./playwright.js";

export const RUN_REPORT_VERSION = 1;

export type FailureClass = "app-bug" | "env-flake" | "spend-cap-abort";
export type InputStatus = "present" | "absent" | "corrupt";
export type RuntimeCoverage = "covered" | "skipped-tonight" | "failed" | "not-run";

export interface TierTotals {
  tier: string;
  status: InputStatus;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  appBug: number;
  envFlake: number;
  spendCapAbort: number;
}

export interface ClassifiedFailure {
  tier: string;
  projectName: string;
  test: string;
  failureClass: FailureClass;
  suiteSuspect: boolean;
  detail: string;
}

export interface SkippedTest {
  tier: string;
  test: string;
  reason: string;
}

export interface CoverageCell {
  route: string;
  component: string;
  state: string;
  spec: string;
  label: string;
  runtime: RuntimeCoverage;
}

export interface CoverageGap {
  route: string;
  component: string;
  state: string;
  category: string;
  reason: string;
}

export interface CoverageSection {
  status: InputStatus;
  mappedCells: number;
  cells: CoverageCell[];
  gaps: CoverageGap[];
}

export interface JournalSummary {
  status: InputStatus;
  intents: number;
  outcomes: number;
  unmatchedIntents: number;
}

export type LeftoverSection = { status: "present"; report: LeftoverReport } | { status: "absent" | "corrupt" };

export interface RunReport {
  version: number;
  generatedAt: string;
  tiers: TierTotals[];
  failures: ClassifiedFailure[];
  skips: SkippedTest[];
  journal: JournalSummary;
  leftover: LeftoverSection;
  coverage: CoverageSection;
}

export interface SummaryFailure {
  test: string;
  detail: string;
}

export type TierSource =
  | { kind: "playwright"; report: unknown }
  | { kind: "summary"; passed: number; skipped: number; failures: readonly SummaryFailure[] }
  | { kind: "absent" }
  | { kind: "corrupt" };

export interface TierInput {
  tier: string;
  source: TierSource;
}

export type JournalInput = { kind: "present"; records: JournalRecord[] } | { kind: "absent" } | { kind: "corrupt" };
export type LeftoverInput = { kind: "present"; report: LeftoverReport } | { kind: "absent" } | { kind: "corrupt" };
export type MatrixInput = { kind: "present"; matrix: CoverageMatrix } | { kind: "absent" } | { kind: "corrupt" };

export interface AggregateInput {
  generatedAt: string;
  tiers: TierInput[];
  journal: JournalInput;
  leftover: LeftoverInput;
  matrix: MatrixInput;
  redactValues: readonly string[];
}

type Scrubber = (text: string) => string;

// A suite-suspect app-bug is one whose failure text reads like a broken locator/timeout/selector
// rather than a real app regression — still app-red urgency, but labelled so triage can tell a
// stale test apart from a genuine app break. Tested against the raw (pre-scrub) error text.
const SUITE_SUSPECT = /locator|selector|timeout|timed out|waiting for|element .*not|getby|tobevisible|strict mode/i;
const SPEND_CAP = /spend[-\s]?cap|spend cap (reached|exceeded|hit)/i;
const SKIP_ANNOTATION = "t3-flow-skip";

interface Classified {
  failure: ClassifiedFailure | null;
  skip: SkippedTest | null;
}

const NONE: Classified = { failure: null, skip: null };

function failure(
  test: RunTest,
  failureClass: FailureClass,
  suiteSuspect: boolean,
  detail: string,
  scrub: Scrubber
): Classified {
  return {
    failure: {
      tier: test.tier,
      projectName: test.projectName,
      test: scrub(test.title),
      failureClass,
      suiteSuspect,
      detail
    },
    skip: null
  };
}

function skip(test: RunTest, reason: string, scrub: Scrubber): Classified {
  return { failure: null, skip: { tier: test.tier, test: scrub(test.title), reason } };
}

function skipAnnotation(test: RunTest): { category: string; reason: string } | null {
  for (const annotation of test.annotations) {
    if (annotation.type !== SKIP_ANNOTATION) {
      continue;
    }
    const colon = annotation.description.indexOf(":");
    if (colon < 0) {
      return { category: annotation.description.trim(), reason: "" };
    }
    return {
      category: annotation.description.slice(0, colon).trim(),
      reason: annotation.description.slice(colon + 1).trim()
    };
  }
  return null;
}

function classifySkip(test: RunTest, scrub: Scrubber): Classified {
  const annotation = skipAnnotation(test);
  if (annotation === null) {
    return skip(test, "", scrub);
  }
  const reason = scrub(annotation.reason);
  if (annotation.category === "environment") {
    return failure(test, "env-flake", false, reason, scrub);
  }
  if (annotation.category === "app") {
    return failure(test, "app-bug", SUITE_SUSPECT.test(annotation.reason), reason, scrub);
  }
  if (SPEND_CAP.test(annotation.reason)) {
    return failure(test, "spend-cap-abort", false, reason, scrub);
  }
  return skip(test, reason, scrub);
}

function classifyTest(test: RunTest, scrub: Scrubber): Classified {
  if (test.status === "passed") {
    return NONE;
  }
  if (test.status === "failed") {
    return failure(test, "app-bug", SUITE_SUSPECT.test(test.errorText), scrub(test.errorText), scrub);
  }
  return classifySkip(test, scrub);
}

function emptyTotals(tier: string, status: InputStatus): TierTotals {
  return { tier, status, total: 0, passed: 0, failed: 0, skipped: 0, appBug: 0, envFlake: 0, spendCapAbort: 0 };
}

function countFailure(totals: TierTotals, failureClass: FailureClass): TierTotals {
  const next = { ...totals, failed: totals.failed + 1 };
  switch (failureClass) {
    case "app-bug":
      return { ...next, appBug: next.appBug + 1 };
    case "env-flake":
      return { ...next, envFlake: next.envFlake + 1 };
    case "spend-cap-abort":
      return { ...next, spendCapAbort: next.spendCapAbort + 1 };
    default: {
      const exhaustive: never = failureClass;
      throw new Error(`unhandled failure class: ${String(exhaustive)}`);
    }
  }
}

interface TierResult {
  totals: TierTotals;
  failures: ClassifiedFailure[];
  skips: SkippedTest[];
  tests: RunTest[];
}

function aggregatePlaywrightTier(tier: string, report: unknown, scrub: Scrubber): TierResult {
  const tests = extractRunTests(report, tier);
  let totals = emptyTotals(tier, "present");
  const failures: ClassifiedFailure[] = [];
  const skips: SkippedTest[] = [];
  for (const test of tests) {
    const { failure: fail, skip: skipped } = classifyTest(test, scrub);
    if (fail !== null) {
      failures.push(fail);
      totals = countFailure(totals, fail.failureClass);
    } else if (skipped !== null) {
      skips.push(skipped);
      totals.skipped += 1;
    } else {
      totals.passed += 1;
    }
  }
  totals.total = totals.passed + totals.failed + totals.skipped;
  return { totals, failures, skips, tests };
}

function aggregateSummaryTier(
  tier: string,
  source: Extract<TierSource, { kind: "summary" }>,
  scrub: Scrubber
): TierResult {
  const totals = emptyTotals(tier, "present");
  totals.passed = source.passed;
  totals.skipped = source.skipped;
  const failures = source.failures.map((entry) => ({
    tier,
    projectName: tier,
    test: scrub(entry.test),
    failureClass: "app-bug" as const,
    suiteSuspect: false,
    detail: scrub(entry.detail)
  }));
  totals.appBug = failures.length;
  totals.failed = failures.length;
  totals.total = totals.passed + totals.failed + totals.skipped;
  return { totals, failures, skips: [], tests: [] };
}

function aggregateTier(input: TierInput, scrub: Scrubber): TierResult {
  if (input.source.kind === "playwright") {
    return aggregatePlaywrightTier(input.tier, input.source.report, scrub);
  }
  if (input.source.kind === "summary") {
    return aggregateSummaryTier(input.tier, input.source, scrub);
  }
  return { totals: emptyTotals(input.tier, input.source.kind), failures: [], skips: [], tests: [] };
}

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? path : path.slice(slash + 1);
}

function matchesLabel(test: RunTest, spec: string, label: string): boolean {
  if (basename(test.file) !== basename(spec)) {
    return false;
  }
  return test.title.includes(label) || test.annotations.some((a) => a.description.includes(label));
}

function reduceRuntime(matched: RunTest[]): RuntimeCoverage {
  if (matched.length === 0) {
    return "not-run";
  }
  if (matched.some((test) => test.status === "failed")) {
    return "failed";
  }
  if (matched.some((test) => test.status === "passed")) {
    return "covered";
  }
  return "skipped-tonight";
}

function coverageForCell(cell: Cell, tests: RunTest[]): CoverageCell | null {
  if (cell.mapping.type !== "assertion") {
    return null;
  }
  const { spec, label } = cell.mapping;
  const matched = tests.filter((test) => matchesLabel(test, spec, label));
  return {
    route: cell.route,
    component: cell.component,
    state: cell.state,
    spec,
    label,
    runtime: reduceRuntime(matched)
  };
}

function gapForCell(cell: Cell): CoverageGap | null {
  if (cell.mapping.type !== "gap") {
    return null;
  }
  return {
    route: cell.route,
    component: cell.component,
    state: cell.state,
    category: cell.mapping.category,
    reason: cell.mapping.reason
  };
}

function coverageSection(matrix: MatrixInput, tests: RunTest[]): CoverageSection {
  if (matrix.kind !== "present") {
    return { status: matrix.kind, mappedCells: 0, cells: [], gaps: [] };
  }
  const cells: CoverageCell[] = [];
  const gaps: CoverageGap[] = [];
  for (const cell of matrix.matrix.cells) {
    const covered = coverageForCell(cell, tests);
    if (covered !== null) {
      cells.push(covered);
    }
    const gap = gapForCell(cell);
    if (gap !== null) {
      gaps.push(gap);
    }
  }
  return { status: "present", mappedCells: cells.length, cells, gaps };
}

function journalSummary(input: JournalInput): JournalSummary {
  if (input.kind !== "present") {
    return { status: input.kind, intents: 0, outcomes: 0, unmatchedIntents: 0 };
  }
  return {
    status: "present",
    intents: input.records.filter(isIntent).length,
    outcomes: input.records.filter(isOutcome).length,
    unmatchedIntents: unmatchedIntents(input.records).length
  };
}

function leftoverSection(input: LeftoverInput): LeftoverSection {
  if (input.kind === "present") {
    return { status: "present", report: input.report };
  }
  return { status: input.kind };
}

/**
 * Fold the night's inputs into one versioned {@link RunReport}. Pure: every input arrives already
 * classified as present / absent / corrupt, so a missing journal or a torn matrix becomes an
 * explicit status field rather than a throw that would lose the rest of the report. Every
 * human-facing string is run through the caller's scrubber here, so the emitted `report.json` is
 * already free of the resolver host and any secret before it is ever written or rendered.
 */
export function aggregate(input: AggregateInput, scrub: Scrubber): RunReport {
  const tierResults = input.tiers.map((tier) => aggregateTier(tier, scrub));
  const tests = tierResults.flatMap((result) => result.tests);
  return {
    version: RUN_REPORT_VERSION,
    generatedAt: input.generatedAt,
    tiers: tierResults.map((result) => result.totals),
    failures: tierResults.flatMap((result) => result.failures),
    skips: tierResults.flatMap((result) => result.skips),
    journal: journalSummary(input.journal),
    leftover: leftoverSection(input.leftover),
    coverage: coverageSection(input.matrix, tests)
  };
}
