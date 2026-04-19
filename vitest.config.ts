import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig({ mode: "test", command: "serve" } as any),
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
      exclude: ["node_modules", "dist", "backend"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        include: ["src/**/*.{ts,vue}"],
        exclude: [
          "src/**/*.d.ts",
          "src/**/*.test.ts",
          "src/**/*.spec.ts",
          "src/main.ts",
          "src/entry-client.ts",
          "src/i18n.ts",
          "src/push/**",
          "src/assets/**",
          "src/config/global/**"
        ],
        thresholds: {
          // Phase 3 global floors — set just below current actuals (15.71% / 89.84% / 64.21% / 15.71%)
          // to catch regressions without fighting routine changes. Phases 4+ ratchet these up
          // as more source surface gets covered.
          lines: 14,
          branches: 88,
          functions: 63,
          statements: 14,
          // Per-file floors for Phase 1 target files (utils + api)
          "src/common/utils/LeaseCalculator.ts": {
            lines: 85,
            branches: 80,
            functions: 95,
            statements: 85
          },
          "src/common/utils/NumberFormatUtils.ts": {
            lines: 85,
            branches: 80,
            functions: 95,
            statements: 85
          },
          "src/common/utils/LeaseUtils.ts": {
            lines: 90,
            branches: 85,
            functions: 100,
            statements: 90
          },
          "src/common/utils/IbcUtils.ts": {
            lines: 100,
            branches: 100,
            functions: 100,
            statements: 100
          },
          "src/common/utils/WalletUtils.ts": {
            lines: 55,
            branches: 45,
            functions: 65,
            statements: 55
          },
          "src/common/api/schemas/index.ts": {
            lines: 95,
            branches: 90,
            functions: 100,
            statements: 95
          },
          "src/common/api/BackendApi.ts": {
            lines: 75,
            branches: 70,
            functions: 90,
            statements: 75
          },
          // Per-file floors for Phase 3 Pinia stores.
          // Small/medium stores — at or near 100%.
          "src/common/stores/connection/index.ts": {
            lines: 95,
            branches: 95,
            functions: 95,
            statements: 95
          },
          "src/common/stores/wallet/index.ts": {
            lines: 95,
            branches: 95,
            functions: 95,
            statements: 95
          },
          "src/common/stores/prices/index.ts": {
            lines: 95,
            branches: 95,
            functions: 95,
            statements: 95
          },
          "src/common/stores/staking/index.ts": {
            lines: 95,
            branches: 85,
            functions: 95,
            statements: 95
          },
          "src/common/stores/earn/index.ts": {
            lines: 95,
            branches: 85,
            functions: 95,
            statements: 95
          },
          "src/common/stores/balances/index.ts": {
            lines: 90,
            branches: 90,
            functions: 95,
            statements: 90
          },
          "src/common/stores/leases/index.ts": {
            lines: 80,
            branches: 80,
            functions: 70,
            statements: 80
          },
          // Large stores — intentionally lower floors; breadth-over-depth.
          "src/common/stores/config/index.ts": {
            lines: 65,
            branches: 80,
            functions: 35,
            statements: 65
          },
          "src/common/stores/history/index.ts": {
            lines: 85,
            branches: 85,
            functions: 85,
            statements: 85
          },
          "src/common/stores/stats/index.ts": {
            lines: 80,
            branches: 85,
            functions: 60,
            statements: 80
          },
          "src/common/stores/analytics/index.ts": {
            lines: 70,
            branches: 70,
            functions: 55,
            statements: 70
          }
        }
      }
    }
  })
);
