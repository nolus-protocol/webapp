import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/t0.ts", "src/http.ts", "src/ws.ts", "src/t1/**"],
      reporter: ["text", "json-summary"],
      // Ratchet floors pinned just under measured actuals. The pure modules
      // (config/decimal/report/validate) sit at 97-100%; the global is pulled down by
      // the network runners in the check files and resolver's connector, which have no
      // unit tests. Floors track actuals while this branch evolves; once merged, the
      // shipped baseline is one-way: raise as coverage improves, never lower.
      thresholds: {
        statements: 79,
        branches: 78,
        functions: 73,
        lines: 79
      }
    }
  }
});
