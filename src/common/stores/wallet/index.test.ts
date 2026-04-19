import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ThemeManager (pulled in via the utils barrel from wallet actions) reads
// window.matchMedia at module import time. jsdom doesn't provide it by default.
// Use vi.hoisted so the stub runs BEFORE the store import below is executed.
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

// The wallet actions barrel imports from "@/common/utils", which has a
// circular dependency on this wallet store (WalletConnect.ts imports
// WalletActions). In a Vite dev build this works; in Vitest's module
// transform the enum is undefined when WalletConnect.ts initializes.
// Mock the actions barrel with stub functions — we're testing the store
// shape, not individual wallet-connect flows (those are Phase 4 scope).
vi.mock("./actions", () => ({
  actions: {
    DISCONNECT: () => undefined,
    CONNECT_KEPLR: () => undefined,
    CONNECT_LEAP: () => undefined,
    CONNECT_LEDGER: () => undefined,
    CONNECT_EVM_PHANTOM: () => undefined,
    CONNECT_SOL_SOLFLARE: () => undefined,
    LOAD_VESTED_TOKENS: () => undefined,
    LOAD_APR: () => undefined,
    ignoreAssets: () => undefined
  }
}));

// Getters module imports `useHistoryStore` from ../../history which itself
// imports utils. Mock its outputs so index.ts load stays cheap and
// deterministic. Only keep the three getter fns — history-store integration
// is Phase B.9's concern.
vi.mock("./getters", () => ({
  getters: {
    vestTokens: () => ({
      amount: { toString: () => "0" },
      denom: "unls"
    }),
    history: () => ({}),
    historyItems: () => [],
    activities: () => ({ data: [] })
  }
}));

import { useWalletStore, WalletActions } from "./index";

describe("useWalletStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return initial state defaults", () => {
    const store = useWalletStore();
    expect(store.vest).toEqual([]);
    expect(store.delegated_vesting).toBeUndefined();
    expect(store.delegated_free).toBeUndefined();
    expect(store.apr).toBe(0);
    expect(store.wallet).toBeUndefined();
  });

  it("should allow mutation via $patch", () => {
    const store = useWalletStore();
    store.$patch({ apr: 5 });
    expect(store.apr).toBe(5);

    store.$patch({
      delegated_vesting: { denom: "unls", amount: "100" },
      delegated_free: { denom: "unls", amount: "50" }
    });
    expect(store.delegated_vesting).toEqual({ denom: "unls", amount: "100" });
    expect(store.delegated_free).toEqual({ denom: "unls", amount: "50" });
  });

  it("should allow mutation via $patch function form", () => {
    const store = useWalletStore();
    store.$patch((state) => {
      state.vest = [
        {
          start: new Date("2026-01-01"),
          end: new Date("2027-01-01"),
          amount: { denom: "unls", amount: "1000" }
        }
      ];
    });
    expect(store.vest).toHaveLength(1);
    expect(store.vest[0].amount.amount).toBe("1000");
  });

  it("should expose all declared action keys as functions", () => {
    const store = useWalletStore();
    // Actions are registered for each WalletActions enum value plus ignoreAssets
    expect(typeof store[WalletActions.DISCONNECT]).toBe("function");
    expect(typeof store[WalletActions.CONNECT_KEPLR]).toBe("function");
    expect(typeof store[WalletActions.CONNECT_LEAP]).toBe("function");
    expect(typeof store[WalletActions.CONNECT_LEDGER]).toBe("function");
    expect(typeof store[WalletActions.CONNECT_EVM_PHANTOM]).toBe("function");
    expect(typeof store[WalletActions.CONNECT_SOL_SOLFLARE]).toBe("function");
    expect(typeof store[WalletActions.LOAD_VESTED_TOKENS]).toBe("function");
    expect(typeof store[WalletActions.LOAD_APR]).toBe("function");
    expect(typeof store.ignoreAssets).toBe("function");
  });

  it("should expose vestTokens getter which returns an object with amount+denom", () => {
    const store = useWalletStore();
    // vestTokens is a mocked stub here (the real impl has a heavy nolusjs
    // dep graph that pulls ThemeManager). We still assert the wire-up:
    // the getter is invokable via the store surface.
    const result = store.vestTokens;
    expect(result).toMatchObject({ denom: expect.any(String) });
    expect(result.amount.toString()).toBe("0");
  });

  it("should expose history/historyItems/activities getter keys on the store surface", () => {
    const store = useWalletStore();
    // Use `in` to verify key presence WITHOUT triggering getter evaluation
    // (which would lazily create the history store and its dependencies).
    expect("history" in store).toBe(true);
    expect("historyItems" in store).toBe(true);
    expect("activities" in store).toBe(true);
  });

  it("exposes the WalletActions enum with expected members", () => {
    // Smoke check that the enum re-export path is intact.
    expect(WalletActions.DISCONNECT).toBe("DISCONNECT");
    expect(WalletActions.CONNECT_KEPLR).toBe("CONNECT_KEPLR");
    expect(WalletActions.LOAD_APR).toBe("LOAD_APR");
  });
});
