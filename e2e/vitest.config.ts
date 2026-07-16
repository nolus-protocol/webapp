import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/t0.ts", "src/http.ts", "src/ws.ts"],
      reporter: ["text", "json-summary"],
      // Ratchet floors pinned just under measured post-fix actuals. The pure modules
      // (config/decimal/report/validate) sit at 97-100%; the global is pulled down by
      // the network runners in the check files and resolver's connector, which have no
      // unit tests. Raise these as coverage improves; never lower them.
      thresholds: {
        statements: 80,
        branches: 78,
        functions: 74,
        lines: 80
      }
    }
  }
});
