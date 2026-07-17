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
