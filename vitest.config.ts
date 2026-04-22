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
          // Global floors. Branches relaxed to 80 to absorb partially-covered
          // widgets like PositionSummaryWidget (smoke-tested for the specific
          // rounding regression path, other branches intentionally out of
          // scope). Per-file floors still ratchet the pure-logic modules.
          lines: 27,
          branches: 80,
          functions: 70,
          statements: 27,
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
          },
          // Per-file floors for Phase 4 wallet + signing target files.
          // Pure logic files — very high bar.
          "src/networks/cosm/encode.ts": {
            lines: 95,
            branches: 90,
            functions: 100,
            statements: 95
          },
          "src/networks/cosm/accountParser.ts": {
            lines: 100,
            branches: 100,
            functions: 100,
            statements: 100
          },
          "src/networks/utilities.ts": {
            lines: 95,
            branches: 75,
            functions: 100,
            statements: 95
          },
          "src/networks/evm/sign.ts": {
            lines: 100,
            branches: 90,
            functions: 100,
            statements: 100
          },
          "src/common/composables/useAsyncOperation.ts": {
            lines: 95,
            branches: 85,
            functions: 100,
            statements: 95
          },
          // Wallet classes — high bar.
          "src/networks/cosm/Wallet.ts": {
            lines: 95,
            branches: 85,
            functions: 95,
            statements: 95
          },
          "src/networks/cosm/NolusWalletOverride.ts": {
            lines: 95,
            branches: 85,
            functions: 95,
            statements: 95
          },
          "src/networks/sol/wallet.ts": {
            lines: 95,
            branches: 85,
            functions: 95,
            statements: 95
          },
          "src/networks/evm/wallet.ts": {
            lines: 95,
            branches: 75,
            functions: 95,
            statements: 95
          },
          "src/networks/cosm/WalletFactory.ts": {
            lines: 95,
            branches: 90,
            functions: 95,
            statements: 95
          },
          // BaseWallet — complex, inherits from SigningCosmWasmClient.
          "src/networks/cosm/BaseWallet.ts": {
            lines: 70,
            branches: 60,
            functions: 85,
            statements: 70
          },
          "src/common/utils/SkipRoute.ts": {
            lines: 75,
            branches: 85,
            functions: 65,
            statements: 75
          },
          // Per-file floors for Phase 6 Vue component + router smoke tests.
          // Components are large and heavily store-dependent — smoke tests
          // cover render, validation, submit path; deeper branches are
          // intentionally out of scope. Floors sit just below current actuals.
          "src/modules/stake/components/RedelegateButton.vue": {
            lines: 80,
            branches: 85,
            functions: 95,
            statements: 80
          },
          "src/modules/stake/components/DelegateForm.vue": {
            lines: 80,
            branches: 65,
            functions: 95,
            statements: 80
          },
          "src/modules/stake/components/UndelegateForm.vue": {
            lines: 90,
            branches: 70,
            functions: 95,
            statements: 90
          },
          "src/modules/vote/components/VoteDialog.vue": {
            lines: 90,
            branches: 85,
            functions: 75,
            statements: 90
          },
          "src/modules/leases/components/NewLease.vue": {
            lines: 95,
            branches: 95,
            functions: 95,
            statements: 95
          },
          "src/modules/leases/components/single-lease/CloseDialog.vue": {
            lines: 55,
            branches: 50,
            functions: 45,
            statements: 55
          },
          "src/modules/leases/components/single-lease/RepayDialog.vue": {
            lines: 45,
            branches: 60,
            functions: 30,
            statements: 45
          },
          "src/router/index.ts": {
            lines: 75,
            branches: 70,
            functions: 70,
            statements: 75
          }
        }
      }
    }
  })
);
