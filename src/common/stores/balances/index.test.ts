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
  const captured: {
     
    onBalances: ((addr: string, balances: any) => void) | null;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = { onBalances: null, unsubscribe: vi.fn() };

  const BackendApi = {
    getBalances: vi.fn()
  };
  const subscribeBalances = vi.fn(
     
    (_addr: string, cb: (addr: string, balances: any) => void) => {
      captured.onBalances = cb;
      return captured.unsubscribe;
    }
  );

  return { captured, BackendApi, subscribeBalances };
});

vi.mock("@/common/api", () => ({
  BackendApi: hoisted.BackendApi,
  WebSocketClient: {
    subscribeBalances: hoisted.subscribeBalances
  }
}));

// Stub the config store — filteredBalances reads it. We expose exactly the
// methods the store uses, with test-configurable return values.
const configState = {
  protocolFilter: "OSMOSIS",
  isValidNetworkFilter: vi.fn((_f: string) => true),
  getAssetTickersForNetwork: vi.fn((_f: string) => [] as string[]),
  getActiveProtocolsForNetwork: vi.fn((_f: string) => [] as string[]),
   
  getCurrencyByDenom: vi.fn((_d: string) => undefined as any)
};
vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => configState
}));

const connectionState = {
  walletAddress: null as string | null,
  wsReconnectCount: 0
};
vi.mock("@/common/stores/connection", () => ({
  useConnectionStore: () => connectionState
}));

import { useBalancesStore } from "./index";

const { captured, BackendApi, subscribeBalances } = hoisted;

type BalanceRec = {
  key: string;
  symbol: string;
  denom: string;
  amount: string;
  amount_usd: string;
  decimal_digits: number;
};

const mkBalance = (o: Partial<BalanceRec>): BalanceRec => ({
  key: "USDC@OSMOSIS",
  symbol: "USDC",
  denom: "ibc/usdc",
  amount: "100",
  amount_usd: "100",
  decimal_digits: 6,
  ...o
});

describe("useBalancesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    captured.onBalances = null;
    captured.unsubscribe = vi.fn();
    subscribeBalances.mockImplementation((_addr, cb) => {
      captured.onBalances = cb;
      return captured.unsubscribe;
    });
    connectionState.walletAddress = null;
    connectionState.wsReconnectCount = 0;
    configState.protocolFilter = "OSMOSIS";
    configState.isValidNetworkFilter = vi.fn(() => true);
    configState.getAssetTickersForNetwork = vi.fn(() => []);
    configState.getActiveProtocolsForNetwork = vi.fn(() => []);
    configState.getCurrencyByDenom = vi.fn(() => undefined);
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state defaults", () => {
    const store = useBalancesStore();
    expect(store.balances).toEqual([]);
    expect(store.address).toBeNull();
    expect(store.totalValueUsd).toBe("0");
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.ignoredCurrencies).toEqual([]);
    expect(store.hasBalances).toBe(false);
    expect(store.isConnected).toBe(false);
    expect(store.nativeBalance).toBeUndefined();
  });

  it("reads ignored_currencies from localStorage on store creation", () => {
    localStorage.setItem("ignored_currencies", JSON.stringify(["STRD", "JUNO"]));
    const store = useBalancesStore();
    expect(store.ignoredCurrencies).toEqual(["STRD", "JUNO"]);
  });

  it("swallows invalid JSON in localStorage and logs a warning", () => {
    localStorage.setItem("ignored_currencies", "{not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = useBalancesStore();
    expect(store.ignoredCurrencies).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignoreCurrency adds and persists to localStorage", () => {
    const store = useBalancesStore();
    store.ignoreCurrency("STRD");
    expect(store.ignoredCurrencies).toEqual(["STRD"]);
    expect(JSON.parse(localStorage.getItem("ignored_currencies") ?? "[]")).toEqual(["STRD"]);
  });

  it("ignoreCurrency is a no-op when ticker already present", () => {
    const store = useBalancesStore();
    store.ignoreCurrency("STRD");
    store.ignoreCurrency("STRD");
    expect(store.ignoredCurrencies).toEqual(["STRD"]);
  });

  it("unignoreCurrency removes and persists", () => {
    const store = useBalancesStore();
    store.setIgnoredCurrencies(["STRD", "JUNO"]);
    store.unignoreCurrency("STRD");
    expect(store.ignoredCurrencies).toEqual(["JUNO"]);
    expect(JSON.parse(localStorage.getItem("ignored_currencies") ?? "[]")).toEqual(["JUNO"]);
  });

  it("unignoreCurrency is a no-op when ticker not present", () => {
    const store = useBalancesStore();
    store.setIgnoredCurrencies(["JUNO"]);
    store.unignoreCurrency("UNKNOWN");
    expect(store.ignoredCurrencies).toEqual(["JUNO"]);
  });

  it("setIgnoredCurrencies replaces the list wholesale", () => {
    const store = useBalancesStore();
    store.ignoreCurrency("A");
    store.setIgnoredCurrencies(["X", "Y"]);
    expect(store.ignoredCurrencies).toEqual(["X", "Y"]);
  });

  it("fetchBalances is a no-op without an address", async () => {
    const store = useBalancesStore();
    await store.fetchBalances();
    expect(BackendApi.getBalances).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
  });

  it("fetchBalances populates balances/totalValueUsd/lastUpdated", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ amount: "42" })],
      total_value_usd: "42"
    });

    const store = useBalancesStore();
    await store.setAddress("nolus1x");
    expect(store.balances.length).toBe(1);
    expect(store.totalValueUsd).toBe("42");
    expect(store.lastUpdated).toBeInstanceOf(Date);
  });

  it("fetchBalances toggles loading only on initial load", async () => {
    BackendApi.getBalances.mockResolvedValue({
      balances: [mkBalance({})],
      total_value_usd: "1"
    });

    const store = useBalancesStore();
    await store.setAddress("nolus1x"); // first load sets lastUpdated
    expect(store.loading).toBe(false);

    // Second fetch: lastUpdated set → loading should NOT flip to true.
    const p = store.fetchBalances();
    expect(store.loading).toBe(false);
    await p;
    expect(store.loading).toBe(false);
  });

  it("fetchBalances sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getBalances.mockRejectedValueOnce(new Error("bad gw"));

    const store = useBalancesStore();
    await store.setAddress("nolus1x");
    expect(store.error).toBe("bad gw");

    spy.mockRestore();
  });

  it("fetchBalances uses generic message on non-Error reject", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getBalances.mockRejectedValueOnce("boom");

    const store = useBalancesStore();
    await store.setAddress("nolus1x");
    expect(store.error).toBe("Failed to fetch balances");

    spy.mockRestore();
  });

  it("getBalance / getBalanceInfo / getBalanceAsNumber / hasBalance behave consistently", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ denom: "uusdc", amount: "12.5" })],
      total_value_usd: "12.5"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    expect(store.getBalance("uusdc")).toBe("12.5");
    expect(store.getBalance("missing")).toBe("0");
    expect(store.getBalanceInfo("uusdc")?.amount).toBe("12.5");
    expect(store.getBalanceInfo("missing")).toBeUndefined();
    expect(store.getBalanceAsNumber("uusdc")).toBeCloseTo(12.5, 5);
    expect(store.getBalanceAsNumber("missing")).toBe(0);
    expect(store.hasBalance("uusdc")).toBe(true);
    expect(store.hasBalance("missing")).toBe(false);

    const zeroBalance = mkBalance({ denom: "uzero", amount: "0" });
     
    (store.balances as any).push(zeroBalance);
    expect(store.hasBalance("uzero")).toBe(false);
  });

  it("getBalanceByKey looks up by currency key", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ key: "USDC@OSMOSIS", amount: "1" })],
      total_value_usd: "1"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    expect(store.getBalanceByKey("USDC@OSMOSIS")?.amount).toBe("1");
    expect(store.getBalanceByKey("NOPE")).toBeUndefined();
  });

  it("nativeBalance computed returns balance for NATIVE_ASSET.denom", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ denom: "unls", amount: "7", key: "NLS@NOLUS", symbol: "NLS" })],
      total_value_usd: "7"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");
    expect(store.nativeBalance?.amount).toBe("7");
  });

  it("isConnected and hasBalances reflect state correctly", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({})],
      total_value_usd: "100"
    });
    const store = useBalancesStore();
    expect(store.isConnected).toBe(false);
    expect(store.hasBalances).toBe(false);

    await store.setAddress("nolus1x");
    expect(store.isConnected).toBe(true);
    expect(store.hasBalances).toBe(true);
  });

  it("ws callback updates balances when address matches", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [],
      total_value_usd: "0"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    expect(captured.onBalances).not.toBeNull();
    captured.onBalances!("nolus1x", [mkBalance({ amount: "5" })]);
    expect(store.balances.length).toBe(1);
    expect(store.balances[0].amount).toBe("5");
  });

  it("ws callback ignores mismatched address", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [],
      total_value_usd: "0"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    captured.onBalances!("nolus1OTHER", [mkBalance({ amount: "99" })]);
    expect(store.balances).toEqual([]);
  });

  it("ws callback ignores non-array payload", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [],
      total_value_usd: "0"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

     
    captured.onBalances!("nolus1x", "not an array" as any);
    expect(store.balances).toEqual([]);
  });

  it("filteredBalances returns empty when filter is invalid", async () => {
    configState.isValidNetworkFilter = vi.fn(() => false);

    const store = useBalancesStore();
    expect(store.filteredBalances).toEqual([]);
  });

  it("filteredBalances returns empty when no tickers are available for the network", async () => {
    configState.isValidNetworkFilter = vi.fn(() => true);
    configState.getAssetTickersForNetwork = vi.fn(() => []);

    const store = useBalancesStore();
    expect(store.filteredBalances).toEqual([]);
  });

  it("filteredBalances dedupes by ticker, preferring network-protocol balances", async () => {
    // Two balances for USDC: one from protocol A (not in network), one from protocol B (in network).
    configState.isValidNetworkFilter = vi.fn(() => true);
    configState.getAssetTickersForNetwork = vi.fn(() => ["USDC"]);
    configState.getActiveProtocolsForNetwork = vi.fn(() => ["B"]);
    configState.getCurrencyByDenom = vi.fn((denom: string) => {
      if (denom === "ibc/a") {
        return { ticker: "USDC", protocol: "A", isActive: true, key: "USDC@A" };
      }
      if (denom === "ibc/b") {
        return { ticker: "USDC", protocol: "B", isActive: true, key: "USDC@B" };
      }
      return undefined;
    });

    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [
        mkBalance({ denom: "ibc/a", key: "USDC@A", amount: "10" }),
        mkBalance({ denom: "ibc/b", key: "USDC@B", amount: "20" })
      ],
      total_value_usd: "30"
    });

    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    const filtered = store.filteredBalances;
    expect(filtered.length).toBe(1);
    expect(filtered[0].balance?.amount).toBe("20");
  });

  it("filteredBalances skips ignored currencies", async () => {
    configState.isValidNetworkFilter = vi.fn(() => true);
    configState.getAssetTickersForNetwork = vi.fn(() => ["USDC"]);
    configState.getActiveProtocolsForNetwork = vi.fn(() => ["A"]);
    configState.getCurrencyByDenom = vi.fn(() => ({
      ticker: "USDC",
      protocol: "A",
      isActive: true,
      key: "USDC@A"
    }));

    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ denom: "ibc/a", key: "USDC@A", amount: "10" })],
      total_value_usd: "10"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    store.ignoreCurrency("USDC");
    expect(store.filteredBalances).toEqual([]);
  });

  it("filteredBalances skips inactive currencies", async () => {
    configState.isValidNetworkFilter = vi.fn(() => true);
    configState.getAssetTickersForNetwork = vi.fn(() => ["STRD"]);
    configState.getActiveProtocolsForNetwork = vi.fn(() => ["A"]);
    configState.getCurrencyByDenom = vi.fn(() => ({
      ticker: "STRD",
      protocol: "A",
      isActive: false,
      key: "STRD@A"
    }));

    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ denom: "ibc/strd", key: "STRD@A", amount: "10" })],
      total_value_usd: "10"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    expect(store.filteredBalances).toEqual([]);
  });

  it("filteredBalances skips currencies whose ticker is not in network assets", async () => {
    configState.isValidNetworkFilter = vi.fn(() => true);
    configState.getAssetTickersForNetwork = vi.fn(() => ["USDC"]);
    configState.getActiveProtocolsForNetwork = vi.fn(() => ["A"]);
    configState.getCurrencyByDenom = vi.fn(() => ({
      ticker: "JUNO",
      protocol: "A",
      isActive: true,
      key: "JUNO@A"
    }));

    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({ denom: "ibc/juno", key: "JUNO@A", amount: "10" })],
      total_value_usd: "10"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    expect(store.filteredBalances).toEqual([]);
  });

  it("cleanup unsubscribes and resets state", async () => {
    BackendApi.getBalances.mockResolvedValueOnce({
      balances: [mkBalance({})],
      total_value_usd: "1"
    });
    const store = useBalancesStore();
    await store.setAddress("nolus1x");

    store.cleanup();
    expect(captured.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.address).toBeNull();
    expect(store.balances).toEqual([]);
    expect(store.totalValueUsd).toBe("0");
  });
});
