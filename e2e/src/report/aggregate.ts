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

interface TierAccumulator {
  totals: TierTotals;
  failures: ClassifiedFailure[];
  skips: SkippedTest[];
}

/** Classify one test and fold it into its (project-derived) tier accumulator. */
function classifyInto(acc: TierAccumulator, test: RunTest, scrub: Scrubber): void {
  const { failure: fail, skip: skipped } = classifyTest(test, scrub);
  if (fail !== null) {
    acc.failures.push(fail);
    acc.totals = countFailure(acc.totals, fail.failureClass);
  } else if (skipped !== null) {
    acc.skips.push(skipped);
    acc.totals.skipped += 1;
  } else {
    acc.totals.passed += 1;
  }
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
interface CollectedTiers {
  order: string[];
  playwrightAcc: Map<string, TierAccumulator>;
  summaryResults: Map<string, TierResult>;
  sourceStatus: Map<string, InputStatus>;
  allTests: RunTest[];
}

/**
 * Fold every source into per-tier accumulators keyed by each test's PROJECT-derived tier (not the
 * file it was read from). `order` keeps the caller's source order, then any extra tier a project
 * mapped onto that no source declared, in discovery order.
 */
function collectTiers(inputs: readonly TierInput[], scrub: Scrubber): CollectedTiers {
  const order: string[] = [];
  for (const tierInput of inputs) {
    if (!order.includes(tierInput.tier)) {
      order.push(tierInput.tier);
    }
  }
  const collected: CollectedTiers = {
    order,
    playwrightAcc: new Map(),
    summaryResults: new Map(),
    sourceStatus: new Map(),
    allTests: []
  };
  const ensureAcc = (tier: string): TierAccumulator => {
    let acc = collected.playwrightAcc.get(tier);
    if (acc === undefined) {
      acc = { totals: emptyTotals(tier, "present"), failures: [], skips: [] };
      collected.playwrightAcc.set(tier, acc);
      if (!order.includes(tier)) {
        order.push(tier);
      }
    }
    return acc;
  };
  for (const tierInput of inputs) {
    if (tierInput.source.kind === "playwright") {
      // Materialize the source tier even when every one of its tests maps elsewhere, so a file
      // that ran but held only foreign-project tests still reports present with zero of its own.
      ensureAcc(tierInput.tier);
      for (const test of extractRunTests(tierInput.source.report, tierInput.tier)) {
        collected.allTests.push(test);
        classifyInto(ensureAcc(test.tier), test, scrub);
      }
    } else if (tierInput.source.kind === "summary") {
      collected.summaryResults.set(tierInput.tier, aggregateSummaryTier(tierInput.tier, tierInput.source, scrub));
    } else {
      collected.sourceStatus.set(tierInput.tier, tierInput.source.kind);
    }
  }
  return collected;
}

interface AssembledTiers {
  tiers: TierTotals[];
  failures: ClassifiedFailure[];
  skips: SkippedTest[];
}

/** Emit the ordered tier totals + flattened failures/skips from the collected accumulators. */
function assembleTiers(collected: CollectedTiers): AssembledTiers {
  const assembled: AssembledTiers = { tiers: [], failures: [], skips: [] };
  for (const tier of collected.order) {
    const acc = collected.playwrightAcc.get(tier);
    if (acc !== undefined) {
      acc.totals.total = acc.totals.passed + acc.totals.failed + acc.totals.skipped;
      assembled.tiers.push(acc.totals);
      assembled.failures.push(...acc.failures);
      assembled.skips.push(...acc.skips);
      continue;
    }
    const summary = collected.summaryResults.get(tier);
    if (summary !== undefined) {
      assembled.tiers.push(summary.totals);
      assembled.failures.push(...summary.failures);
      assembled.skips.push(...summary.skips);
      continue;
    }
    assembled.tiers.push(emptyTotals(tier, collected.sourceStatus.get(tier) ?? "absent"));
  }
  return assembled;
}

export function aggregate(input: AggregateInput, scrub: Scrubber): RunReport {
  const collected = collectTiers(input.tiers, scrub);
  const assembled = assembleTiers(collected);
  return {
    version: RUN_REPORT_VERSION,
    generatedAt: input.generatedAt,
    tiers: assembled.tiers,
    failures: assembled.failures,
    skips: assembled.skips,
    journal: journalSummary(input.journal),
    leftover: leftoverSection(input.leftover),
    coverage: coverageSection(input.matrix, collected.allTests)
  };
}
