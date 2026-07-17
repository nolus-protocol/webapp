import { test, expect } from "./support.js";
import type { Page } from "@playwright/test";
import type { OriginContext, ConnectLabels } from "./appDriver.js";
import {
  resolveOrigin,
  fetchLocale,
  readConnectLabels,
  connectKeplr,
  waitForAppShell,
  assertConnected
} from "./appDriver.js";
import { allowStagingNoise } from "./matrixHelpers.js";

// A browser-level socket drop: neither context.setOffline nor CDP offline emulation closes
// an established WebSocket in headless chromium (verified), so the app socket is closed
// directly. A pre-boot init script wraps window.WebSocket to record every `/ws` instance
// WITHOUT changing app behavior (it still constructs the real native socket); the test then
// closes it. The app's own onclose is still attached (this is not its disconnect() path), so
// it runs its real cleanup -> scheduleReconnect -> reconnect, exactly as a network drop would.

const WRAP_WS = `(() => {
  const Native = window.WebSocket;
  window.__e2eSockets = [];
  const Wrapped = function (url, protocols) {
    const socket = protocols === undefined ? new Native(url) : new Native(url, protocols);
    try { if (String(url).endsWith('/ws')) window.__e2eSockets.push(socket); } catch (e) { void e; }
    return socket;
  };
  Wrapped.prototype = Native.prototype;
  Wrapped.CONNECTING = Native.CONNECTING; Wrapped.OPEN = Native.OPEN;
  Wrapped.CLOSING = Native.CLOSING; Wrapped.CLOSED = Native.CLOSED;
  window.WebSocket = Wrapped;
})();`;

const CLOSE_APP_SOCKET = `(() => {
  const list = window.__e2eSockets || [];
  const open = list.filter((s) => s.readyState === WebSocket.OPEN);
  open.forEach((s) => s.close());
  return open.length;
})()`;

const EXPECTED_TOPICS = ["prices", "balances", "leases", "earn"];
const REFETCH_ENDPOINTS = ["/api/balances", "/api/leases", "/api/earn/positions", "/api/staking/positions"];
const RECONNECT_TIMEOUT = 20000;

interface SocketRecord {
  sentTopics: string[];
  closed: boolean;
}

function subscribeTopic(payload: string | Buffer): string | undefined {
  const text = typeof payload === "string" ? payload : payload.toString("utf8");
  try {
    const frame = JSON.parse(text) as { type?: string; topic?: string };
    return frame.type === "subscribe" ? frame.topic : undefined;
  } catch {
    return undefined;
  }
}

function trackSockets(page: Page): SocketRecord[] {
  const sockets: SocketRecord[] = [];
  page.on("websocket", (ws) => {
    if (!ws.url().endsWith("/ws")) return;
    const record: SocketRecord = { sentTopics: [], closed: false };
    sockets.push(record);
    ws.on("framesent", (frame) => {
      const topic = subscribeTopic(frame.payload);
      if (topic !== undefined) record.sentTopics.push(topic);
    });
    ws.on("close", () => (record.closed = true));
  });
  return sockets;
}

let ctx: OriginContext;
let labels: ConnectLabels;

test.beforeAll(async () => {
  ctx = resolveOrigin();
  labels = readConnectLabels(await fetchLocale(ctx));
});

test.afterAll(async () => {
  if (ctx.dispatcher !== undefined) await ctx.dispatcher.close();
});

test("reconnect resubscribes every topic and refetches user data", async ({ page, budget, wallet }) => {
  budget.route = "/";
  allowStagingNoise(budget);
  budget.allow.consoleErrors.push(/\[WebSocket\]/);

  await page.addInitScript(WRAP_WS);
  const sockets = trackSockets(page);
  const refetches: string[] = [];
  page.on("request", (req) => {
    if (req.method() !== "GET") return;
    const pathname = new URL(req.url()).pathname;
    if (REFETCH_ENDPOINTS.includes(pathname)) refetches.push(pathname);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
  await connectKeplr(page, labels);
  await assertConnected(page, wallet.address);

  // The first socket must have subscribed to every expected topic before we drop it.
  await expect
    .poll(() => (sockets[0] ? [...new Set(sockets[0].sentTopics)].sort() : []), {
      message: "the initial socket should subscribe to all user topics",
      timeout: RECONNECT_TIMEOUT
    })
    .toEqual([...EXPECTED_TOPICS].sort());

  const refetchBaseline = refetches.length;
  const closed = await page.evaluate<number>(CLOSE_APP_SOCKET);
  expect(closed, "exactly one open app socket should have been closed").toBe(1);

  // Fail loudly if the socket never actually closes.
  await expect
    .poll(() => sockets[0]?.closed ?? false, { message: "the app socket must close", timeout: RECONNECT_TIMEOUT })
    .toBe(true);

  // A fresh socket opens and re-subscribes exactly one frame per topic (staking has no WS
  // topic — removed in #276 — so it is deliberately absent).
  await expect
    .poll(() => sockets.length, { message: "a replacement socket should open", timeout: RECONNECT_TIMEOUT })
    .toBeGreaterThanOrEqual(2);
  await expect
    .poll(() => (sockets[1] ? [...sockets[1].sentTopics].sort() : []), {
      message: "the reconnected socket should resubscribe one frame per topic",
      timeout: RECONNECT_TIMEOUT
    })
    .toEqual([...EXPECTED_TOPICS].sort());

  // useWalletWatcher.onReconnect refetches balances/leases/earn/staking (staking has no WS
  // topic but is still refetched over REST). analytics/history are NOT refetched.
  await expect
    .poll(() => [...new Set(refetches.slice(refetchBaseline))].sort(), {
      message: "reconnect should refetch every user-data endpoint once",
      timeout: RECONNECT_TIMEOUT
    })
    .toEqual([...REFETCH_ENDPOINTS].sort());

  expect(page.isClosed(), "the page must not crash on reconnect").toBe(false);
});
