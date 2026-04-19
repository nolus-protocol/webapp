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
          // Phase 1 global floors — set just below current actuals (5.43% / 87.15% / 79.41% / 5.43%)
          // to catch regressions without fighting routine changes. Phases 2+ ratchet these up
          // as more source surface gets covered.
          lines: 5,
          branches: 80,
          functions: 70,
          statements: 5,
          // Per-file floors for the Phase 1 target files
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
          }
        }
      }
    }
  })
);
