import { defineConfig } from "@playwright/test";
import { parseT1Config } from "./src/config.js";
import { buildHostResolverRules } from "./src/resolver.js";
import type { T2Options } from "./src/t2/support.js";

const parsed = parseT1Config(process.env);
if (!parsed.ok) {
  throw new Error(`E2E T1 configuration error:\n  - ${parsed.errors.join("\n  - ")}`);
}

const { baseUrl, hostOverrides } = parsed.config;
const resolverRules = buildHostResolverRules(hostOverrides);
const launchArgs = resolverRules.length > 0 ? [`--host-resolver-rules=${resolverRules}`] : [];
const isCI = Boolean(process.env.CI);

export default defineConfig<T2Options>({
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  workers: 2,
  timeout: 60000,
  retries: isCI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "results/t1.json" }]
  ],
  use: {
    baseURL: baseUrl,
    headless: true,
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: isCI ? "on-first-retry" : "off",
    launchOptions: { args: launchArgs }
  },
  projects: [
    {
      name: "desktop-light",
      testDir: "src/t1",
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    },
    {
      name: "desktop-dark",
      testDir: "src/t1",
      use: { viewport: { width: 1440, height: 900 }, themeData: "dark" }
    },
    {
      name: "mobile",
      testDir: "src/t1",
      use: { viewport: { width: 390, height: 844 }, themeData: "light" }
    },
    {
      name: "t2",
      testDir: "src/t2",
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    }
  ]
});
