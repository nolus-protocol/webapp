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
    ["json", { outputFile: "results/playwright-report.json" }]
  ],
  use: {
    baseURL: baseUrl,
    headless: true,
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
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
      // Fixture-mode functional specs (boot smoke, oracle bridge, fault injection,
      // integrity). Deterministic: all /api + /ws are intercepted from the committed
      // fixture set, so no live backend or wallet is touched. The SPA bundle itself still
      // loads from baseURL, so the host-resolver launch args are still required.
      name: "fixture",
      testDir: "src/ui",
      testMatch: ["**/boot.spec.ts", "**/bridge.spec.ts", "**/faults.spec.ts", "**/integrity.spec.ts"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    },
    {
      name: "visual-desktop-light",
      testDir: "src/ui",
      testMatch: ["**/visual.spec.ts"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light", deviceScaleFactor: 1 }
    },
    {
      name: "visual-desktop-dark",
      testDir: "src/ui",
      testMatch: ["**/visual.spec.ts"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "dark", deviceScaleFactor: 1 }
    },
    {
      name: "visual-mobile-light",
      testDir: "src/ui",
      testMatch: ["**/visual.spec.ts"],
      use: { viewport: { width: 390, height: 844 }, themeData: "light", deviceScaleFactor: 1 }
    },
    {
      name: "visual-mobile-dark",
      testDir: "src/ui",
      testMatch: ["**/visual.spec.ts"],
      use: { viewport: { width: 390, height: 844 }, themeData: "dark", deviceScaleFactor: 1 }
    },
    {
      name: "t2",
      testDir: "src/t2",
      // The parallel-safe matrix: connect, validation, classify, reconnect. Rate-limit and
      // receive are separate serialized projects (below).
      testMatch: ["**/connect.spec.ts", "**/validation.spec.ts", "**/classify.spec.ts", "**/reconnect.spec.ts"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    },
    {
      // The strict rate-limit bucket is shared per client IP, so this must not run
      // concurrently with any other egress: it depends on t2 and runs after it, alone.
      name: "ratelimit",
      testDir: "src/t2",
      testMatch: ["**/ratelimit.spec.ts"],
      dependencies: ["t2"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    },
    {
      // A live on-chain send; runs last and never retries so a retry can't double-send.
      name: "receive",
      testDir: "src/t2",
      testMatch: ["**/receive.spec.ts"],
      retries: 0,
      dependencies: ["t2", "ratelimit"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    },
    {
      // The tx-engine live smoke, appended to the dependency chain so it inherits the full
      // serialization; a settle delay in the spec refills the strict rate bucket after ratelimit.
      name: "t3-engine",
      testDir: "src/t3",
      testMatch: ["**/engine.spec.ts"],
      retries: 0,
      dependencies: ["t2", "ratelimit", "receive"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    },
    {
      // The T3 value-moving flows (lease, earn, stake, send, ibc, swap). Appended after the
      // engine so the whole run shares one serialized chain and the per-run spend cap is
      // meaningful; the singleton engine constructor throws under workers > 1, so this project
      // must be run with --workers=1 (the t3:flows script). Never retries — a retry could
      // double-spend a governed broadcast.
      name: "t3-flows",
      testDir: "src/t3/flows",
      testMatch: ["**/*.spec.ts"],
      retries: 0,
      dependencies: ["t3-engine"],
      use: { viewport: { width: 1440, height: 900 }, themeData: "light" }
    }
  ]
});
