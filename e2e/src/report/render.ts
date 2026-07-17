import type { LeftoverReport } from "../t3/report.js";
import type {
  ClassifiedFailure,
  CoverageSection,
  JournalSummary,
  LeftoverSection,
  RunReport,
  SkippedTest,
  TierTotals
} from "./aggregate.js";

type Scrubber = (text: string) => string;

function firstLine(text: string): string {
  const line = text.split("\n").find((entry) => entry.trim().length > 0);
  return (line ?? "").trim();
}

function tierRow(tier: TierTotals): string {
  const cells = [
    tier.tier,
    tier.status,
    tier.total,
    tier.passed,
    tier.failed,
    tier.skipped,
    tier.appBug,
    tier.envFlake,
    tier.spendCapAbort
  ];
  return `| ${cells.join(" | ")} |`;
}

function tierTable(tiers: TierTotals[]): string {
  const header =
    "| Tier | Status | Total | Passed | Failed | Skipped | App-bug | Env-flake | Spend-cap |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  return [header, ...tiers.map(tierRow)].join("\n");
}

function failureLine(failure: ClassifiedFailure, scrub: Scrubber): string {
  const suspect = failure.suiteSuspect ? " [suite-suspect]" : "";
  const detail = firstLine(scrub(failure.detail));
  return `- [${failure.failureClass}]${suspect} ${failure.tier}/${failure.projectName} — ${scrub(failure.test)}: ${detail}`;
}

function failureSection(failures: ClassifiedFailure[], scrub: Scrubber): string {
  if (failures.length === 0) {
    return "## Failures\n\nNo classified failures.";
  }
  return `## Failures\n\n${failures.map((failure) => failureLine(failure, scrub)).join("\n")}`;
}

function skipSection(skips: SkippedTest[], scrub: Scrubber): string {
  if (skips.length === 0) {
    return "## Skipped tonight\n\nNothing skipped.";
  }
  const lines = skips.map((skip) => `- ${skip.tier} — ${scrub(skip.test)}: ${firstLine(scrub(skip.reason))}`);
  return `## Skipped tonight\n\n${lines.join("\n")}`;
}

function leftoverBody(report: LeftoverReport, scrub: Scrubber): string {
  const spend = report.spend.map((line) => `${line.denom} ${line.spentMicro}/${line.capMicro}`).join(", ");
  const warnings = report.warnings.map((warning) => scrub(warning)).join("; ");
  return [
    `terminal=${report.terminal} openLeases=${report.openLeases.length} ` +
      `pendingUnbondings=${report.pendingUnbondings.length} unfinishedSwaps=${report.unfinishedSwaps.length}`,
    `spend (micro): ${spend || "none"}`,
    `warnings: ${warnings || "none"}`
  ].join("\n");
}

function leftoverSection(leftover: LeftoverSection, scrub: Scrubber): string {
  if (leftover.status !== "present") {
    return `## Leftover state (t3)\n\nNo leftover report (${leftover.status}).`;
  }
  return `## Leftover state (t3)\n\n${leftoverBody(leftover.report, scrub)}`;
}

function coverageSection(coverage: CoverageSection): string {
  if (coverage.status !== "present") {
    return `## Runtime coverage\n\nNo coverage matrix (${coverage.status}).`;
  }
  const covered = coverage.cells.filter((cell) => cell.runtime === "covered").length;
  const skippedTonight = coverage.cells.filter((cell) => cell.runtime === "skipped-tonight");
  const failed = coverage.cells.filter((cell) => cell.runtime === "failed").length;
  const notRun = coverage.cells.filter((cell) => cell.runtime === "not-run").length;
  const summary =
    `mapped cells: ${coverage.mappedCells} (${covered} covered, ${skippedTonight.length} skipped tonight, ` +
    `${failed} failed, ${notRun} not run); gaps: ${coverage.gaps.length}`;
  const skippedLines = skippedTonight.map(
    (cell) => `- skipped tonight: ${cell.route} | ${cell.component} | ${cell.state} (${cell.label})`
  );
  const gapLines = coverage.gaps.map(
    (gap) => `- gap [${gap.category}]: ${gap.route} | ${gap.component} | ${gap.state}`
  );
  return [`## Runtime coverage`, "", summary, ...skippedLines, ...gapLines].join("\n");
}

function journalSection(journal: JournalSummary): string {
  if (journal.status !== "present") {
    return `## Journal\n\nNo journal (${journal.status}).`;
  }
  return `## Journal\n\nintents=${journal.intents} outcomes=${journal.outcomes} unmatched=${journal.unmatchedIntents}`;
}

/** Render the run report as a human-readable markdown summary. Every dynamic string is re-scrubbed. */
export function renderMarkdown(report: RunReport, scrub: Scrubber): string {
  return [
    `# E2E Regression Report (v${report.version})`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Tier totals",
    "",
    tierTable(report.tiers),
    "",
    failureSection(report.failures, scrub),
    "",
    skipSection(report.skips, scrub),
    "",
    leftoverSection(report.leftover, scrub),
    "",
    coverageSection(report.coverage),
    "",
    journalSection(report.journal),
    ""
  ].join("\n");
}
