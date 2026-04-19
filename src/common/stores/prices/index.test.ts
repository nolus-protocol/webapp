import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Shim window.matchMedia before store import: ThemeManager (via @/common/utils)
// reads it at module init time and jsdom doesn't provide it.
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

// Mock state needs to be hoisted so `vi.mock`'s factory (also hoisted) can
// reference it. Without `vi.hoisted`, the factory runs before these const
// declarations and crashes with "cannot access before initialization".
const hoisted = vi.hoisted(() => {
  const captured: {
    onPrices: ((payload: Record<string, string>) => void) | null;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = {
    onPrices: null,
    unsubscribe: vi.fn()
  };
  const getPricesMock = vi.fn();
  const subscribePricesMock = vi.fn((cb: (payload: Record<string, string>) => void) => {
    captured.onPrices = cb;
    return captured.unsubscribe;
  });
  return { captured, getPricesMock, subscribePricesMock };
});
const { captured, getPricesMock, subscribePricesMock } = hoisted;

vi.mock("@/common/api", () => ({
  BackendApi: {
    getPrices: hoisted.getPricesMock
  },
  WebSocketClient: {
    subscribePrices: hoisted.subscribePricesMock
  }
}));

import { usePricesStore } from "./index";

describe("usePricesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    captured.onPrices = null;
    captured.unsubscribe = vi.fn();
    // Re-wire the subscribe mock since resetAllMocks cleared implementations
    subscribePricesMock.mockImplementation((cb) => {
      captured.onPrices = cb;
      return captured.unsubscribe;
    });
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state defaults", () => {
    const store = usePricesStore();
    expect(store.prices).toEqual({});
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.priceCount).toBe(0);
  });

  it("fetchPrices populates state on success", async () => {
    const payload = {
      "USDC@OSMOSIS": { price: "1.0001", symbol: "USDC" },
      "NLS@NOLUS": { price: "0.012", symbol: "NLS" }
    };
    getPricesMock.mockResolvedValueOnce(payload);

    const store = usePricesStore();
    await store.fetchPrices();

    expect(store.prices).toEqual(payload);
    expect(store.priceCount).toBe(2);
    expect(store.lastUpdated).toBeInstanceOf(Date);
    expect(store.error).toBeNull();
  });

  it("fetchPrices sets error on failure without throwing", async () => {
    getPricesMock.mockRejectedValueOnce(new Error("network down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const store = usePricesStore();
    await expect(store.fetchPrices()).resolves.toBeUndefined();
    expect(store.error).toBe("network down");

    spy.mockRestore();
  });

  it("fetchPrices falls back to a generic message when the reject is not an Error", async () => {
    getPricesMock.mockRejectedValueOnce("boom");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const store = usePricesStore();
    await store.fetchPrices();
    expect(store.error).toBe("Failed to fetch prices");

    spy.mockRestore();
  });

  it("fetchPrices toggles loading only on initial load", async () => {
    getPricesMock.mockResolvedValue({ "A@P": { price: "1", symbol: "A" } });
    const store = usePricesStore();

    // Initial load — loading should be true during the await
    const p1 = store.fetchPrices();
    expect(store.loading).toBe(true);
    await p1;
    expect(store.loading).toBe(false);
    expect(store.lastUpdated).toBeInstanceOf(Date);

    // Second load — lastUpdated is set, so loading should NOT toggle
    const p2 = store.fetchPrices();
    expect(store.loading).toBe(false);
    await p2;
    expect(store.loading).toBe(false);
  });

  it("getPrice returns the price string or null", async () => {
    getPricesMock.mockResolvedValueOnce({ "USDC@A": { price: "1.0", symbol: "USDC" } });
    const store = usePricesStore();
    await store.fetchPrices();

    expect(store.getPrice("USDC@A")).toBe("1.0");
    expect(store.getPrice("UNKNOWN@X")).toBeNull();
  });

  it("getPriceAsNumber returns parsed float or zero", async () => {
    getPricesMock.mockResolvedValueOnce({ "USDC@A": { price: "1.25", symbol: "USDC" } });
    const store = usePricesStore();
    await store.fetchPrices();

    expect(store.getPriceAsNumber("USDC@A")).toBe(1.25);
    expect(store.getPriceAsNumber("MISSING@X")).toBe(0);
  });

  it("hasPrice reflects key presence", async () => {
    getPricesMock.mockResolvedValueOnce({ "USDC@A": { price: "1.0", symbol: "USDC" } });
    const store = usePricesStore();
    await store.fetchPrices();

    expect(store.hasPrice("USDC@A")).toBe(true);
    expect(store.hasPrice("NLS@B")).toBe(false);
  });

  it("initialize fetches then subscribes once even when called repeatedly", async () => {
    getPricesMock.mockResolvedValue({ "USDC@A": { price: "1.0", symbol: "USDC" } });

    const store = usePricesStore();
    await store.initialize();
    expect(getPricesMock).toHaveBeenCalledTimes(1);
    expect(subscribePricesMock).toHaveBeenCalledTimes(1);

    // Second initialize: fetch runs again, but subscribe stays de-duped.
    await store.initialize();
    expect(subscribePricesMock).toHaveBeenCalledTimes(1);
  });

  it("ws callback merges updates preserving existing symbol", async () => {
    getPricesMock.mockResolvedValueOnce({ "USDC@A": { price: "1.0", symbol: "USDC" } });
    const store = usePricesStore();
    await store.initialize();

    expect(captured.onPrices).not.toBeNull();
    captured.onPrices!({ "USDC@A": "1.05" });
    expect(store.prices["USDC@A"]).toEqual({ price: "1.05", symbol: "USDC" });
  });

  it("ws callback synthesizes symbol from key when absent", async () => {
    getPricesMock.mockResolvedValueOnce({});
    const store = usePricesStore();
    await store.initialize();

    captured.onPrices!({ "DOT@X": "5.0" });
    expect(store.prices["DOT@X"]).toEqual({ price: "5.0", symbol: "DOT" });
  });

  it("ws callback refreshes lastUpdated", async () => {
    getPricesMock.mockResolvedValueOnce({});
    const store = usePricesStore();
    await store.initialize();

    const before = store.lastUpdated;
    // Force a measurable time gap
    await new Promise((r) => setTimeout(r, 5));
    captured.onPrices!({ "A@P": "1" });
    expect(store.lastUpdated).not.toBe(before);
    expect(store.lastUpdated!.getTime()).toBeGreaterThanOrEqual(before!.getTime());
  });

  it("cleanup unsubscribes from WS and allows re-subscribe", async () => {
    getPricesMock.mockResolvedValueOnce({});
    const store = usePricesStore();
    await store.initialize();

    store.cleanup();
    expect(captured.unsubscribe).toHaveBeenCalledTimes(1);

    // Rebind a fresh unsubscribe and re-subscribe via initialize.
    captured.unsubscribe = vi.fn();
    subscribePricesMock.mockImplementationOnce((cb) => {
      captured.onPrices = cb;
      return captured.unsubscribe;
    });
    getPricesMock.mockResolvedValueOnce({});
    await store.initialize();
    expect(subscribePricesMock).toHaveBeenCalledTimes(2);
  });

  it("cleanup is a no-op when never subscribed", () => {
    const store = usePricesStore();
    expect(() => store.cleanup()).not.toThrow();
    expect(captured.unsubscribe).not.toHaveBeenCalled();
  });
});
