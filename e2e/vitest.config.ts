import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/t0.ts",
        "src/http.ts",
        "src/ws.ts",
        "src/broadcast.ts",
        "src/t3/journalStore.ts",
        "src/t3/runtime.ts",
        "src/t3/repair.ts",
        // Reporting-tier fs/network glue: reads the tier result files, writes report.json +
        // report.md, and posts the alert. The pure aggregate/render/alert/scrub modules it
        // composes are unit-tested; the CLI shell itself is exercised by the regression workflow.
        "src/report/cli.ts",
        "src/report/preflight.ts",
        // T3 flow browser/network glue — the run singleton, live API reads, and form driver are
        // exercised by the live t3-flows suite, not vitest. The pure helpers they compose
        // (sideSelection, seq, tolerance, preconditions) stay included and unit-tested.
        "src/t3/flows/support.ts",
        "src/t3/flows/apiReads.ts",
        "src/t3/flows/formDriver.ts",
        "src/t3/flows/renderFigure.ts",
        "src/t1/**",
        "src/t2/**",
        // Browser glue (Playwright fixtures / specs) is exercised by the live and
        // fixture-mode suites, not vitest. The pure logic it drives — the oracle, the
        // fixture loader, and the schema validator — stays included and unit-tested.
        "src/ui/**",
        "src/fixtures/support.ts"
      ],
      reporter: ["text", "json-summary"],
      // Ratchet floors pinned just under measured actuals. The pure modules
      // (config/decimal/report/validate/signer) sit at 93-100%; the global is pulled down
      // by the network runners in the check files and resolver's connector, which have no
      // unit tests. Floors track actuals while this branch evolves; once merged, the
      // shipped baseline is one-way: raise as coverage improves, never lower.
      thresholds: {
        statements: 88,
        branches: 83,
        functions: 86,
        lines: 88
      }
    }
  }
});
