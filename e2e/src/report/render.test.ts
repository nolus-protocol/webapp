import { describe, expect, it } from "vitest";
import type { LeftoverReport } from "../t3/report.js";
import type { ClassifiedFailure, RunReport } from "./aggregate.js";
import { renderMarkdown } from "./render.js";
import { makeScrubber } from "./scrub.js";

function runReport(overrides: Partial<RunReport>): RunReport {
  return {
    version: 1,
    generatedAt: "2026-07-17T00:00:00.000Z",
    tiers: [
      {
        tier: "t3-flows",
        status: "present",
        total: 2,
        passed: 1,
        failed: 1,
        skipped: 0,
        appBug: 1,
        envFlake: 0,
        spendCapAbort: 0
      }
    ],
    failures: [],
    skips: [],
    journal: { status: "present", intents: 3, outcomes: 2, unmatchedIntents: 1 },
    leftover: { status: "absent" },
    coverage: { status: "absent", mappedCells: 0, cells: [], gaps: [] },
    ...overrides
  };
}

const identity = (text: string): string => text;

describe("renderMarkdown", () => {
  it("renders tier totals, suite-suspect failures, skipped-tonight cells and gaps", () => {
    const failure: ClassifiedFailure = {
      tier: "t3-flows",
      projectName: "t3-flows",
      test: "form driver",
      failureClass: "app-bug",
      suiteSuspect: true,
      detail: "Timeout waiting for locator"
    };
    const md = renderMarkdown(
      runReport({
        failures: [failure],
        coverage: {
          status: "present",
          mappedCells: 1,
          cells: [
            {
              route: "/earn",
              component: "primary-figure",
              state: "populated",
              spec: "earn.spec.ts",
              label: "earn supply",
              runtime: "skipped-tonight"
            }
          ],
          gaps: [
            { route: "/", component: "visual", state: "populated", category: "visual-local-only", reason: "local only" }
          ]
        }
      }),
      identity
    );
    expect(md).toContain("| Tier | Status | Total |");
    expect(md).toContain("[app-bug] [suite-suspect] t3-flows/t3-flows — form driver");
    expect(md).toContain("skipped tonight: /earn | primary-figure | populated");
    expect(md).toContain("gap [visual-local-only]");
    expect(md).toContain("intents=3 outcomes=2 unmatched=1");
  });

  it("leaves no IP, resolver host or mnemonic in the rendered report given adversarial fields", () => {
    const resolver = "deploy-host.internal";
    const mnemonic = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const leftover: LeftoverReport = {
      suite: "t3",
      version: 1,
      generatedAt: "t",
      terminal: "app-failure",
      openLeases: [],
      pendingUnbondings: [],
      unfinishedSwaps: [],
      spend: [],
      warnings: [`leak ${resolver} and ${mnemonic}`]
    };
    const md = renderMarkdown(
      runReport({
        failures: [
          {
            tier: "t3-flows",
            projectName: "t3-flows",
            test: "x",
            failureClass: "app-bug",
            suiteSuspect: false,
            detail: `boom 10.1.2.3 ${resolver} ${mnemonic}`
          }
        ],
        skips: [{ tier: "t3-flows", test: "y", reason: `skip ${resolver}` }],
        leftover: { status: "present", report: leftover }
      }),
      makeScrubber([resolver, mnemonic])
    );
    expect(md).not.toContain("10.1.2.3");
    expect(md).not.toContain(resolver);
    expect(md).not.toContain("abandon ability able");
  });

  it("renders explicit absent markers for missing sections", () => {
    const md = renderMarkdown(
      runReport({ journal: { status: "absent", intents: 0, outcomes: 0, unmatchedIntents: 0 } }),
      identity
    );
    expect(md).toContain("No classified failures.");
    expect(md).toContain("Nothing skipped.");
    expect(md).toContain("No leftover report (absent).");
    expect(md).toContain("No coverage matrix (absent).");
    expect(md).toContain("No journal (absent).");
  });
});
