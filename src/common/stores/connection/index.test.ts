import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    (window as any).matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    });
  }
});

const hoisted = vi.hoisted(() => {
  // Capture the connection-state callback passed to
  // WebSocketClient.onConnectionStateChange so tests can simulate WS events.
  const captured: {
    onConnectionState: ((state: string) => void) | null;
    onConnectionStateUnsubscribe: ReturnType<typeof vi.fn>;
  } = { onConnectionState: null, onConnectionStateUnsubscribe: vi.fn() };

  const wsClient = {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    onConnectionStateChange: vi.fn((cb: (state: string) => void) => {
      captured.onConnectionState = cb;
      return captured.onConnectionStateUnsubscribe;
    })
  };

  return { captured, wsClient };
});

vi.mock("@/common/api", () => ({
  WebSocketClient: hoisted.wsClient
}));

// Dependent stores — stubs that track .initialize() and .cleanup() calls.
const mkInit = () => ({ initialize: vi.fn(async () => {}), cleanup: vi.fn() });
const configStore = mkInit();
const pricesStore = mkInit();
const stakingStore = mkInit();
const earnStore = mkInit();
const statsStore = mkInit();

vi.mock("../config", () => ({
  useConfigStore: () => configStore
}));
vi.mock("../prices", () => ({
  usePricesStore: () => pricesStore
}));
vi.mock("../staking", () => ({
  useStakingStore: () => stakingStore
}));
vi.mock("../earn", () => ({
  useEarnStore: () => earnStore
}));
vi.mock("../stats", () => ({
  useStatsStore: () => statsStore
}));

import { useConnectionStore } from "./index";

const { captured, wsClient } = hoisted;

describe("useConnectionStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    captured.onConnectionState = null;
    captured.onConnectionStateUnsubscribe = vi.fn();
    wsClient.connect.mockImplementation(async () => {});
    wsClient.onConnectionStateChange.mockImplementation((cb) => {
      captured.onConnectionState = cb;
      return captured.onConnectionStateUnsubscribe;
    });
    configStore.initialize = vi.fn(async () => {});
    configStore.cleanup = vi.fn();
    pricesStore.initialize = vi.fn(async () => {});
    pricesStore.cleanup = vi.fn();
    stakingStore.initialize = vi.fn(async () => {});
    stakingStore.cleanup = vi.fn();
    earnStore.initialize = vi.fn(async () => {});
    earnStore.cleanup = vi.fn();
    statsStore.initialize = vi.fn(async () => {});
    statsStore.cleanup = vi.fn();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state defaults", () => {
    const store = useConnectionStore();
    expect(store.wsState).toBe("disconnected");
    expect(store.walletAddress).toBeNull();
    expect(store.appInitialized).toBe(false);
    expect(store.initializing).toBe(false);
    expect(store.error).toBeNull();
    expect(store.wsReconnectCount).toBe(0);
    expect(store.isWsConnected).toBe(false);
    expect(store.isWalletConnected).toBe(false);
    expect(store.isReady).toBe(false);
  });

  it("connectWallet sets address and flips isWalletConnected", () => {
    const store = useConnectionStore();
    store.connectWallet("nolus1abc");
    expect(store.walletAddress).toBe("nolus1abc");
    expect(store.isWalletConnected).toBe(true);
  });

  it("connectWallet is a no-op on empty string", () => {
    const store = useConnectionStore();
    store.connectWallet("");
    expect(store.walletAddress).toBeNull();
    expect(store.isWalletConnected).toBe(false);
  });

  it("disconnectWallet clears the address to null", () => {
    const store = useConnectionStore();
    store.connectWallet("nolus1abc");
    store.disconnectWallet();
    expect(store.walletAddress).toBeNull();
  });

  it("isReady is true only when both initialized and ws is connected", async () => {
    const store = useConnectionStore();
    expect(store.isReady).toBe(false);

    await store.initializeApp();
    // After initialize: appInitialized = true, but wsState still "disconnected"
    // because the captured onConnectionState callback never fired.
    expect(store.appInitialized).toBe(true);
    expect(store.isWsConnected).toBe(false);
    expect(store.isReady).toBe(false);

    // Now simulate ws "connected" — isReady should flip.
    captured.onConnectionState!("connected");
    expect(store.isWsConnected).toBe(true);
    expect(store.isReady).toBe(true);
  });

  it("initializeApp is idempotent when already initialized", async () => {
    const store = useConnectionStore();
    await store.initializeApp();
    expect(wsClient.connect).toHaveBeenCalledTimes(1);

    await store.initializeApp();
    expect(wsClient.connect).toHaveBeenCalledTimes(1);
  });

  it("initializeApp sets initializing flag during the await", async () => {
    let resolveConnect: () => void = () => {};
    wsClient.connect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        })
    );

    const store = useConnectionStore();
    const p = store.initializeApp();
    // Mid-await: initializing is true
    expect(store.initializing).toBe(true);

    resolveConnect();
    await p;

    expect(store.initializing).toBe(false);
    expect(store.appInitialized).toBe(true);
  });

  it("initializeApp subscribes to ws state and applies updates", async () => {
    const store = useConnectionStore();
    await store.initializeApp();
    expect(captured.onConnectionState).not.toBeNull();

    captured.onConnectionState!("connecting");
    expect(store.wsState).toBe("connecting");

    captured.onConnectionState!("connected");
    expect(store.wsState).toBe("connected");
  });

  it("initializeApp increments wsReconnectCount on reconnection when wallet is connected", async () => {
    const store = useConnectionStore();
    await store.initializeApp();
    store.connectWallet("nolus1abc");

    // First "connected" after a disconnected window → count=1.
    captured.onConnectionState!("disconnected");
    captured.onConnectionState!("connected");
    expect(store.wsReconnectCount).toBe(1);

    // Another cycle → count=2.
    captured.onConnectionState!("disconnected");
    captured.onConnectionState!("connected");
    expect(store.wsReconnectCount).toBe(2);
  });

  it("initializeApp does NOT increment reconnect count without wallet", async () => {
    const store = useConnectionStore();
    await store.initializeApp();
    // No connectWallet.

    captured.onConnectionState!("disconnected");
    captured.onConnectionState!("connected");
    expect(store.wsReconnectCount).toBe(0);
  });

  it("initializeApp sets error and rethrows on failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    wsClient.connect.mockRejectedValueOnce(new Error("socket refused"));

    const store = useConnectionStore();
    await expect(store.initializeApp()).rejects.toThrow("socket refused");
    expect(store.error).toBe("socket refused");
    expect(store.initializing).toBe(false);
    expect(store.appInitialized).toBe(false);

    spy.mockRestore();
  });

  it("initializeApp uses a generic error when reject is not an Error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    wsClient.connect.mockRejectedValueOnce("weird");

    const store = useConnectionStore();
    await expect(store.initializeApp()).rejects.toBe("weird");
    expect(store.error).toBe("Failed to initialize app");

    spy.mockRestore();
  });

  it("initializeApp calls dependent store initializers (config first, others after)", async () => {
    const store = useConnectionStore();
    await store.initializeApp();

    expect(configStore.initialize).toHaveBeenCalledTimes(1);
    expect(pricesStore.initialize).toHaveBeenCalledTimes(1);
    expect(stakingStore.initialize).toHaveBeenCalledTimes(1);
    expect(earnStore.initialize).toHaveBeenCalledTimes(1);
    expect(statsStore.initialize).toHaveBeenCalledTimes(1);

    // Config must finish before the others (ordering check via invocation order).
    const configOrder = configStore.initialize.mock.invocationCallOrder[0];
    const pricesOrder = pricesStore.initialize.mock.invocationCallOrder[0];
    expect(configOrder).toBeLessThan(pricesOrder);
  });

  it("cleanup disconnects ws, invokes dependent cleanups, and resets state", async () => {
    const store = useConnectionStore();
    await store.initializeApp();
    store.connectWallet("nolus1abc");
    captured.onConnectionState!("connected");

    store.cleanup();

    expect(captured.onConnectionStateUnsubscribe).toHaveBeenCalledTimes(1);
    expect(pricesStore.cleanup).toHaveBeenCalledTimes(1);
    expect(statsStore.cleanup).toHaveBeenCalledTimes(1);
    expect(wsClient.disconnect).toHaveBeenCalledTimes(1);
    expect(store.walletAddress).toBeNull();
    expect(store.appInitialized).toBe(false);
    expect(store.wsState).toBe("disconnected");
  });

  it("cleanup invokes dependent-store cleanups BEFORE disconnecting the WebSocket", async () => {
    const store = useConnectionStore();
    await store.initializeApp();

    store.cleanup();

    const pricesOrder = pricesStore.cleanup.mock.invocationCallOrder[0];
    const statsOrder = statsStore.cleanup.mock.invocationCallOrder[0];
    const disconnectOrder = wsClient.disconnect.mock.invocationCallOrder[0];

    expect(pricesOrder).toBeLessThan(disconnectOrder);
    expect(statsOrder).toBeLessThan(disconnectOrder);
  });

  it("cleanup is safe to call when wsStateUnsubscribe was never assigned", () => {
    const store = useConnectionStore();
    // No initializeApp — wsStateUnsubscribe is null.
    expect(() => store.cleanup()).not.toThrow();
    expect(wsClient.disconnect).toHaveBeenCalledTimes(1);
    expect(captured.onConnectionStateUnsubscribe).not.toHaveBeenCalled();
  });
});
