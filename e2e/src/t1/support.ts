import { test as base, expect } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

export interface T1Options {
  themeData: "light" | "dark" | "sync";
}

export interface WsState {
  sawWsUrl: boolean;
  openedAt: number;
  ackReceived: boolean;
  closed: boolean;
  frames: number;
}

/**
 * Per-spec allowlist for entries a spec deliberately provokes. A T2 spec that drives a
 * 429/500 (classify, rate-limit) or a WebSocket drop (`[WebSocket] Error`) declares the
 * exact patterns it expects; anything not matched still fails the budget. Defaults are
 * empty, so T1 (and any spec that never touches this) keeps the strict clean-budget check
 * verbatim. Page errors are never allowlisted — an uncaught page error is never expected.
 */
export interface BudgetAllow {
  consoleErrors: RegExp[];
  failedRequests: RegExp[];
}

export interface BudgetState {
  route: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  failedRequests: string[];
  allow: BudgetAllow;
  ws: WsState;
}

export interface T1Fixtures {
  budget: BudgetState;
}

const ABORTED = "net::ERR_ABORTED";

function createBudgetState(): BudgetState {
  return {
    route: "",
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    failedRequests: [],
    allow: { consoleErrors: [], failedRequests: [] },
    ws: { sawWsUrl: false, openedAt: 0, ackReceived: false, closed: false, frames: 0 }
  };
}

// Seed theme + locale into localStorage before the SPA boots. A string init script
// avoids referencing browser globals in the Node-typed test source; the values are a
// controlled enum, JSON-quoted for safety.
function seedScript(theme: string): string {
  return `try { localStorage.setItem('theme_data', ${JSON.stringify(theme)}); localStorage.setItem('language', 'en'); } catch (e) { void e; }`;
}

function isSameOrigin(url: string, originHost: string): boolean {
  try {
    return new URL(url).host === originHost;
  } catch {
    return false;
  }
}

function isPricesAck(payload: string | Buffer): boolean {
  const text = typeof payload === "string" ? payload : payload.toString("utf8");
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null) return false;
    const frame = parsed as Record<string, unknown>;
    return frame.type === "subscribed" && frame.topic === "prices";
  } catch {
    return false;
  }
}

function attachWsListener(page: Page, ws: WsState): void {
  page.on("websocket", (socket) => {
    if (!socket.url().endsWith("/ws")) return;
    ws.sawWsUrl = true;
    ws.openedAt = Date.now();
    socket.on("framereceived", (frame) => {
      if (isPricesAck(frame.payload)) {
        ws.ackReceived = true;
        ws.frames += 1;
      }
    });
    socket.on("close", () => {
      ws.closed = true;
    });
  });
}

function attachCollectors(page: Page, state: BudgetState, originHost: string): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") state.consoleErrors.push(msg.text());
    else if (msg.type() === "warning") state.consoleWarnings.push(msg.text());
  });
  page.on("pageerror", (err) => state.pageErrors.push(err.message));
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText ?? "unknown";
    if (reason !== ABORTED && isSameOrigin(req.url(), originHost)) {
      state.failedRequests.push(`${req.url()} (${reason})`);
    }
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400 && isSameOrigin(resp.url(), originHost)) {
      state.failedRequests.push(`${resp.url()} (HTTP ${resp.status()})`);
    }
  });
  attachWsListener(page, state.ws);
}

function unexpected(entries: string[], allow: RegExp[]): string[] {
  return entries.filter((entry) => !allow.some((pattern) => pattern.test(entry)));
}

function assertBudgetClean(state: BudgetState, testInfo: TestInfo): void {
  const route = state.route || "(unset)";
  if (state.consoleWarnings.length > 0) {
    testInfo.annotations.push({
      type: "console-warning",
      description: `${route}: ${state.consoleWarnings.join(" | ")}`
    });
  }
  const consoleErrors = unexpected(state.consoleErrors, state.allow.consoleErrors);
  const failedRequests = unexpected(state.failedRequests, state.allow.failedRequests);
  expect(consoleErrors, `console errors on ${route}: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(state.pageErrors, `page errors on ${route}: ${state.pageErrors.join(" | ")}`).toEqual([]);
  expect(failedRequests, `failed same-origin requests on ${route}: ${failedRequests.join(" | ")}`).toEqual([]);
}

export const test = base.extend<T1Options & T1Fixtures>({
  themeData: ["light", { option: true }],
  budget: async ({ page, themeData }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL === undefined) {
      throw new Error("T1 project is missing baseURL (E2E_BASE_URL)");
    }
    await page.addInitScript(seedScript(themeData));
    const state = createBudgetState();
    attachCollectors(page, state, new URL(baseURL).host);
    await use(state);
    assertBudgetClean(state, testInfo);
  }
});

export { expect };
