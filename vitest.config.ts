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
          lines: 0.5,
          functions: 0.5,
          branches: 0.5,
          statements: 0.5
        }
      }
    }
  })
);
