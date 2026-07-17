import { describe, expect, it } from "vitest";
import type { CoverageMatrix } from "../matrix/check.js";
import type { LeftoverReport } from "../t3/report.js";
import { buildIntent } from "../t3/journal.js";
import type { JournalRecord } from "../t3/journal.js";
import { aggregate } from "./aggregate.js";
import type { AggregateInput, TierInput } from "./aggregate.js";

interface FakeTest {
  projectName: string;
  title: string;
  file: string;
  status: "expected" | "unexpected" | "skipped" | "flaky";
  annotations?: { type: string; description: string }[];
  error?: string;
}

function pwReport(tests: FakeTest[]): unknown {
  return {
    suites: [
      {
        file: "",
        specs: tests.map((test) => ({
          title: test.title,
          file: test.file,
          tests: [
            {
              projectName: test.projectName,
              status: test.status,
              annotations: test.annotations ?? [],
              results: [
                {
                  status: test.status === "skipped" ? "skipped" : test.status === "unexpected" ? "failed" : "passed",
                  error: test.error === undefined ? undefined : { message: test.error },
                  errors: test.error === undefined ? [] : [{ message: test.error }],
                  annotations: []
                }
              ]
            }
          ]
        })),
        suites: []
      }
    ]
  };
}

function baseInput(tiers: TierInput[]): AggregateInput {
  return {
    generatedAt: "2026-07-17T00:00:00.000Z",
    tiers,
    journal: { kind: "absent" },
    leftover: { kind: "absent" },
    matrix: { kind: "absent" },
    redactValues: []
  };
}

const identity = (text: string): string => text;

describe("aggregate classification", () => {
  it("tags one failure of each class and treats a plain precondition skip as a skip", () => {
    const report = pwReport([
      {
        projectName: "t3-flows",
        title: "lease opens",
        file: "lease.spec.ts",
        status: "unexpected",
        error: "expect(x).toBe(y) assertion failed"
      },
      {
        projectName: "t3-flows",
        title: "earn supply",
        file: "earn.spec.ts",
        status: "skipped",
        annotations: [{ type: "t3-flow-skip", description: "environment: node-unavailable: rpc down" }]
      },
      {
        projectName: "t3-flows",
        title: "stake delegate",
        file: "stake.spec.ts",
        status: "skipped",
        annotations: [{ type: "t3-flow-skip", description: "precondition: spend cap reached on nls" }]
      },
      {
        projectName: "t3-flows",
        title: "ibc transfer",
        file: "ibc.spec.ts",
        status: "skipped",
        annotations: [{ type: "t3-flow-skip", description: "precondition: unfunded: no balance" }]
      }
    ]);
    const out = aggregate(baseInput([{ tier: "t3-flows", source: { kind: "playwright", report } }]), identity);

    const byTest = new Map(out.failures.map((failure) => [failure.test, failure.failureClass]));
    expect(byTest.get("lease opens")).toBe("app-bug");
    expect(byTest.get("earn supply")).toBe("env-flake");
    expect(byTest.get("stake delegate")).toBe("spend-cap-abort");
    expect(out.skips.map((skip) => skip.test)).toEqual(["ibc transfer"]);

    const tier = out.tiers[0];
    expect(tier).toMatchObject({
      total: 4,
      passed: 0,
      failed: 3,
      skipped: 1,
      appBug: 1,
      envFlake: 1,
      spendCapAbort: 1
    });
  });

  it("flags an app-bug as suite-suspect when the failure text reads like a broken locator", () => {
    const report = pwReport([
      {
        projectName: "t3-flows",
        title: "form driver",
        file: "lease.spec.ts",
        status: "unexpected",
        error: "Timeout 30000ms exceeded waiting for locator('#submit')"
      },
      {
        projectName: "t3-flows",
        title: "balance math",
        file: "earn.spec.ts",
        status: "unexpected",
        error: "expected 5 to equal 6"
      }
    ]);
    const out = aggregate(baseInput([{ tier: "t3-flows", source: { kind: "playwright", report } }]), identity);
    const suspect = new Map(out.failures.map((failure) => [failure.test, failure.suiteSuspect]));
    expect(suspect.get("form driver")).toBe(true);
    expect(suspect.get("balance math")).toBe(false);
  });
});

describe("aggregate runtime coverage", () => {
  const matrix: CoverageMatrix = {
    routes: ["/earn"],
    components: ["primary-figure", "visual"],
    states: ["populated"],
    cells: [
      {
        route: "/earn",
        component: "primary-figure",
        state: "populated",
        mapping: { type: "assertion", spec: "src/t3/flows/earn.spec.ts", label: "earn supply" }
      },
      {
        route: "/earn",
        component: "visual",
        state: "populated",
        mapping: { type: "gap", category: "visual-local-only", reason: "screenshot local only" }
      }
    ]
  };

  it("reports a skipped mapped cell as skipped-tonight, never covered, and always lists gaps", () => {
    const report = pwReport([
      {
        projectName: "t3-flows",
        title: "earn supply",
        file: "src/t3/flows/earn.spec.ts",
        status: "skipped",
        annotations: [{ type: "t3-flow-skip", description: "precondition: unfunded" }]
      }
    ]);
    const out = aggregate(
      {
        ...baseInput([{ tier: "t3-flows", source: { kind: "playwright", report } }]),
        matrix: { kind: "present", matrix }
      },
      identity
    );
    expect(out.coverage.cells).toEqual([
      {
        route: "/earn",
        component: "primary-figure",
        state: "populated",
        spec: "src/t3/flows/earn.spec.ts",
        label: "earn supply",
        runtime: "skipped-tonight"
      }
    ]);
    expect(out.coverage.gaps).toHaveLength(1);
    expect(out.coverage.mappedCells).toBe(1);
  });

  it("reports covered when the mapped test passed and not-run when nothing matched", () => {
    const passed = aggregate(
      {
        ...baseInput([
          {
            tier: "t3-flows",
            source: {
              kind: "playwright",
              report: pwReport([
                { projectName: "t3-flows", title: "earn supply", file: "src/t3/flows/earn.spec.ts", status: "expected" }
              ])
            }
          }
        ]),
        matrix: { kind: "present", matrix }
      },
      identity
    );
    expect(passed.coverage.cells[0]?.runtime).toBe("covered");

    const empty = aggregate({ ...baseInput([]), matrix: { kind: "present", matrix } }, identity);
    expect(empty.coverage.cells[0]?.runtime).toBe("not-run");
  });
});

describe("aggregate inputs and passthrough", () => {
  const leftover: LeftoverReport = {
    suite: "t3",
    version: 1,
    generatedAt: "2026-07-17T00:00:00.000Z",
    terminal: "spend-cap-abort",
    openLeases: [{ address: "nolus1lease", protocol: "OSMOSIS", status: "opened" }],
    pendingUnbondings: [],
    unfinishedSwaps: [],
    spend: [{ denom: "nls", capMicro: "100", spentMicro: "100" }],
    warnings: ["wallet-2 low"]
  };

  it("passes the leftover report through verbatim", () => {
    const out = aggregate({ ...baseInput([]), leftover: { kind: "present", report: leftover } }, identity);
    expect(out.leftover).toEqual({ status: "present", report: leftover });
  });

  it("records absent and corrupt inputs as explicit fields rather than throwing", () => {
    const out = aggregate(
      baseInput([
        { tier: "t0", source: { kind: "corrupt" } },
        { tier: "t1", source: { kind: "absent" } }
      ]),
      identity
    );
    expect(out.tiers[0]).toMatchObject({ tier: "t0", status: "corrupt", total: 0 });
    expect(out.tiers[1]).toMatchObject({ tier: "t1", status: "absent" });
    expect(out.journal.status).toBe("absent");
    expect(out.coverage.status).toBe("absent");
  });

  it("summarizes a present journal and folds a summary tier's failures into app-bugs", () => {
    const journal: JournalRecord[] = [
      buildIntent({ seq: 1, ts: "t", spec: "s", walletRole: "primary", action: "swap", denoms: [] })
    ];
    const out = aggregate(
      {
        ...baseInput([
          {
            tier: "t0",
            source: { kind: "summary", passed: 2, skipped: 1, failures: [{ test: "ws-parity", detail: "mismatch" }] }
          }
        ]),
        journal: { kind: "present", records: journal }
      },
      identity
    );
    expect(out.journal).toEqual({ status: "present", intents: 1, outcomes: 0, unmatchedIntents: 1 });
    expect(out.tiers[0]).toMatchObject({ tier: "t0", passed: 2, skipped: 1, failed: 1, appBug: 1 });
    expect(out.failures[0]).toMatchObject({ tier: "t0", failureClass: "app-bug", test: "ws-parity" });
  });

  it("scrubs failure detail and test titles through the provided scrubber", () => {
    const report = pwReport([
      {
        projectName: "t3-flows",
        title: "host 10.1.2.3",
        file: "f.spec.ts",
        status: "unexpected",
        error: "boom at 10.1.2.3"
      }
    ]);
    const out = aggregate(baseInput([{ tier: "t3-flows", source: { kind: "playwright", report } }]), (text) =>
      text.replace(/10\.1\.2\.3/g, "<x>")
    );
    expect(out.failures[0]?.detail).not.toContain("10.1.2.3");
    expect(out.failures[0]?.test).not.toContain("10.1.2.3");
  });
});

describe("aggregate tier attribution by project", () => {
  it("attributes a mis-filed t3-flows test to t3-flows, never to the t1 source file it landed in", () => {
    // A t3-flows-project test appears in the t1 source file (the run's JSON output path was not
    // overridden, so its json defaulted onto playwright-report.json). Its tier must come from its
    // project, so it counts under t3-flows and never inflates t1.
    const t1File = pwReport([
      { projectName: "desktop-light", title: "assets renders", file: "routes.spec.ts", status: "expected" },
      {
        projectName: "t3-flows",
        title: "lease opens",
        file: "lease.spec.ts",
        status: "unexpected",
        error: "expect(x).toBe(y) assertion failed"
      }
    ]);
    const out = aggregate(
      baseInput([
        { tier: "t1", source: { kind: "playwright", report: t1File } },
        { tier: "t3-flows", source: { kind: "absent" } }
      ]),
      identity
    );

    const byTier = new Map(out.tiers.map((tier) => [tier.tier, tier]));
    expect(byTier.get("t1")).toMatchObject({ status: "present", total: 1, passed: 1, failed: 0 });
    // t3-flows ran (its tests are present here) even though its own result file was absent.
    expect(byTier.get("t3-flows")).toMatchObject({ status: "present", total: 1, failed: 1, appBug: 1 });
    expect(out.failures.map((failure) => [failure.tier, failure.projectName])).toEqual([["t3-flows", "t3-flows"]]);
  });

  it("keeps an unmapped project on the source-file tier via the fallback", () => {
    const report = pwReport([
      { projectName: "some-adhoc-project", title: "custom", file: "x.spec.ts", status: "expected" }
    ]);
    const out = aggregate(baseInput([{ tier: "t2", source: { kind: "playwright", report } }]), identity);
    const byTier = new Map(out.tiers.map((tier) => [tier.tier, tier]));
    expect(byTier.get("t2")).toMatchObject({ status: "present", total: 1, passed: 1 });
  });
});
