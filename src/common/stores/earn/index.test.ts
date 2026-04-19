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
     
    onEarn: ((addr: string, positions: any[], totalUsd: string) => void) | null;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = { onEarn: null, unsubscribe: vi.fn() };

  const BackendApi = {
    getEarnPools: vi.fn(),
    getEarnPositions: vi.fn(),
    getEarnStats: vi.fn(),
    getEtlPools: vi.fn(),
    getSuppliedFunds: vi.fn()
  };

  const subscribeEarn = vi.fn(
    (
      _addr: string,
       
      cb: (addr: string, positions: any[], totalUsd: string) => void
    ) => {
      captured.onEarn = cb;
      return captured.unsubscribe;
    }
  );

  return { captured, BackendApi, subscribeEarn };
});

vi.mock("@/common/api", () => ({
  BackendApi: hoisted.BackendApi,
  WebSocketClient: {
    subscribeEarn: hoisted.subscribeEarn
  }
}));

const connectionState = {
  walletAddress: null as string | null,
  wsReconnectCount: 0
};
vi.mock("@/common/stores/connection", () => ({
  useConnectionStore: () => connectionState
}));

import { useEarnStore } from "./index";

const { captured, BackendApi, subscribeEarn } = hoisted;

describe("useEarnStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    captured.onEarn = null;
    captured.unsubscribe = vi.fn();
    subscribeEarn.mockImplementation((_addr, cb) => {
      captured.onEarn = cb;
      return captured.unsubscribe;
    });
    connectionState.walletAddress = null;
    connectionState.wsReconnectCount = 0;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state defaults", () => {
    const store = useEarnStore();
    expect(store.pools).toEqual([]);
    expect(store.etlPools).toEqual([]);
    expect(store.positions).toEqual([]);
    expect(store.stats).toBeNull();
    expect(store.suppliedFunds).toBeNull();
    expect(store.address).toBeNull();
    expect(store.totalDepositedUsd).toBe("0");
    expect(store.poolsLoading).toBe(false);
    expect(store.positionsLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.initialized).toBe(false);
    expect(store.hasPositions).toBe(false);
    expect(store.poolCount).toBe(0);
    expect(store.totalDeposited).toBe(0);
    expect(store.protocolApr).toEqual({});
  });

  it("fetchPools populates pools", async () => {
    const pools = [
      {
        protocol: "osmosis-noble",
        lpp_address: "nolus1lpp1",
        currency: "USDC",
        total_deposited: "1000",
        apy: 5.5,
        utilization: 0.5,
        available_liquidity: "500"
      }
    ];
    BackendApi.getEarnPools.mockResolvedValueOnce(pools);

    const store = useEarnStore();
    await store.fetchPools();
    expect(store.pools).toEqual(pools);
    expect(store.poolsLoading).toBe(false);
    expect(store.protocolApr).toEqual({ "osmosis-noble": 5.5 });
  });

  it("fetchPools sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getEarnPools.mockRejectedValueOnce(new Error("fail"));

    const store = useEarnStore();
    await store.fetchPools();
    expect(store.error).toBe("fail");
    expect(store.poolsLoading).toBe(false);

    spy.mockRestore();
  });

  it("fetchPools uses generic message on non-Error reject", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getEarnPools.mockRejectedValueOnce("bork");

    const store = useEarnStore();
    await store.fetchPools();
    expect(store.error).toBe("Failed to fetch pools");

    spy.mockRestore();
  });

  it("fetchPositions is a no-op without an address", async () => {
    const store = useEarnStore();
    await store.fetchPositions();
    expect(BackendApi.getEarnPositions).not.toHaveBeenCalled();
    expect(store.positionsLoading).toBe(false);
  });

  it("fetchPositions populates positions and totalDepositedUsd", async () => {
    BackendApi.getEarnPositions.mockResolvedValueOnce({
      positions: [
        {
          protocol: "p1",
          lpp_address: "nolus1lpp1",
          currency: "USDC",
          deposited_nlpn: "100",
          deposited_lpn: "100",
          lpp_price: "1.0",
          current_apy: 5
        }
      ],
      total_deposited_usd: "100.5"
    });

    const store = useEarnStore();
    await store.setAddress("nolus1x");
    expect(store.positions.length).toBe(1);
    expect(store.totalDepositedUsd).toBe("100.5");
    expect(store.lastUpdated).toBeInstanceOf(Date);
    expect(store.hasPositions).toBe(true);
  });

  it("fetchStats populates stats", async () => {
    const stats = {
      total_deposited: "1000",
      total_deposited_usd: "1000",
      average_apy: 5.5,
      total_lenders: 10
    };
    BackendApi.getEarnStats.mockResolvedValueOnce(stats);

    const store = useEarnStore();
    await store.fetchStats();
    expect(store.stats).toEqual(stats);
  });

  it("fetchStats sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getEarnStats.mockRejectedValueOnce(new Error("stats broken"));

    const store = useEarnStore();
    await store.fetchStats();
    expect(store.error).toBe("stats broken");

    spy.mockRestore();
  });

  it("fetchEtlPools populates etlPools from response.protocols", async () => {
    BackendApi.getEtlPools.mockResolvedValueOnce({
      protocols: [{ protocol: "osmosis-noble", deposit_suspension: false }]
    });

    const store = useEarnStore();
    await store.fetchEtlPools();
    expect(store.etlPools).toEqual([{ protocol: "osmosis-noble", deposit_suspension: false }]);
  });

  it("fetchEtlPools sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getEtlPools.mockRejectedValueOnce(new Error("etl fail"));

    const store = useEarnStore();
    await store.fetchEtlPools();
    expect(store.error).toBe("etl fail");

    spy.mockRestore();
  });

  it("fetchSuppliedFunds populates suppliedFunds", async () => {
    BackendApi.getSuppliedFunds.mockResolvedValueOnce({ total: "1000" });

    const store = useEarnStore();
    await store.fetchSuppliedFunds();
    expect(store.suppliedFunds).toEqual({ total: "1000" });
  });

  it("fetchSuppliedFunds sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getSuppliedFunds.mockRejectedValueOnce(new Error("sf fail"));

    const store = useEarnStore();
    await store.fetchSuppliedFunds();
    expect(store.error).toBe("sf fail");

    spy.mockRestore();
  });

  it("getPool / getPosition look up by protocol", async () => {
    BackendApi.getEarnPools.mockResolvedValueOnce([
      {
        protocol: "p1",
        lpp_address: "nolus1a",
        currency: "USDC",
        total_deposited: "0",
        apy: 5,
        utilization: 0,
        available_liquidity: "0"
      }
    ]);
    BackendApi.getEarnPositions.mockResolvedValueOnce({
      positions: [
        {
          protocol: "p1",
          lpp_address: "nolus1a",
          currency: "USDC",
          deposited_nlpn: "1",
          deposited_lpn: "1",
          lpp_price: "1",
          current_apy: 5
        }
      ],
      total_deposited_usd: "1"
    });

    const store = useEarnStore();
    await store.fetchPools();
    await store.setAddress("nolus1x");

    expect(store.getPool("p1")?.protocol).toBe("p1");
    expect(store.getPool("missing")).toBeUndefined();
    expect(store.getPosition("p1")?.protocol).toBe("p1");
    expect(store.getPosition("missing")).toBeUndefined();
  });

  it("getPoolByAddress looks up by lpp_address", async () => {
    BackendApi.getEarnPools.mockResolvedValueOnce([
      {
        protocol: "p1",
        lpp_address: "nolus1lpp",
        currency: "USDC",
        total_deposited: "0",
        apy: 5,
        utilization: 0,
        available_liquidity: "0"
      }
    ]);
    const store = useEarnStore();
    await store.fetchPools();
    expect(store.getPoolByAddress("nolus1lpp")?.protocol).toBe("p1");
    expect(store.getPoolByAddress("missing")).toBeUndefined();
  });

  it("getEtlPool / getProtocolApr look up per-protocol values", async () => {
    BackendApi.getEarnPools.mockResolvedValueOnce([
      {
        protocol: "p1",
        lpp_address: "nolus1a",
        currency: "USDC",
        total_deposited: "0",
        apy: 7.1,
        utilization: 0,
        available_liquidity: "0"
      }
    ]);
    BackendApi.getEtlPools.mockResolvedValueOnce({
      protocols: [{ protocol: "p1", deposit_suspension: true }]
    });
    const store = useEarnStore();
    await Promise.all([store.fetchPools(), store.fetchEtlPools()]);

    expect(store.getEtlPool("p1")).toMatchObject({ deposit_suspension: true });
    expect(store.getEtlPool("missing")).toBeUndefined();
    expect(store.getProtocolApr("p1")).toBe(7.1);
    expect(store.getProtocolApr("missing")).toBe(0);
  });

  it("totalDeposited sums parsed floats across positions", async () => {
    BackendApi.getEarnPositions.mockResolvedValueOnce({
      positions: [
        {
          protocol: "p1",
          lpp_address: "l1",
          currency: "USDC",
          deposited_nlpn: "0",
          deposited_lpn: "10.5",
          lpp_price: "1",
          current_apy: 0
        },
        {
          protocol: "p2",
          lpp_address: "l2",
          currency: "USDC",
          deposited_nlpn: "0",
          deposited_lpn: "4.25",
          lpp_price: "1",
          current_apy: 0
        }
      ],
      total_deposited_usd: "14.75"
    });
    const store = useEarnStore();
    await store.setAddress("nolus1x");
    expect(store.totalDeposited).toBeCloseTo(14.75, 5);
  });

  it("initialize calls all fetchers in parallel and sets initialized when pools are non-empty", async () => {
    BackendApi.getEarnPools.mockResolvedValueOnce([
      {
        protocol: "p1",
        lpp_address: "l1",
        currency: "USDC",
        total_deposited: "0",
        apy: 5,
        utilization: 0,
        available_liquidity: "0"
      }
    ]);
    BackendApi.getEarnStats.mockResolvedValueOnce({
      total_deposited: "0",
      total_deposited_usd: "0",
      average_apy: 5,
      total_lenders: 0
    });
    BackendApi.getEtlPools.mockResolvedValueOnce({ protocols: [] });
    BackendApi.getSuppliedFunds.mockResolvedValueOnce({ total: "0" });

    const store = useEarnStore();
    await store.initialize();

    expect(BackendApi.getEarnPools).toHaveBeenCalledTimes(1);
    expect(BackendApi.getEarnStats).toHaveBeenCalledTimes(1);
    expect(BackendApi.getEtlPools).toHaveBeenCalledTimes(1);
    expect(BackendApi.getSuppliedFunds).toHaveBeenCalledTimes(1);
    expect(store.initialized).toBe(true);
  });

  it("initialize is a no-op when already initialized", async () => {
    BackendApi.getEarnPools.mockResolvedValue([
      {
        protocol: "p",
        lpp_address: "l",
        currency: "USDC",
        total_deposited: "0",
        apy: 0,
        utilization: 0,
        available_liquidity: "0"
      }
    ]);
    BackendApi.getEarnStats.mockResolvedValue({
      total_deposited: "0",
      total_deposited_usd: "0",
      average_apy: 0,
      total_lenders: 0
    });
    BackendApi.getEtlPools.mockResolvedValue({ protocols: [] });
    BackendApi.getSuppliedFunds.mockResolvedValue({ total: "0" });

    const store = useEarnStore();
    await store.initialize();
    expect(BackendApi.getEarnPools).toHaveBeenCalledTimes(1);

    await store.initialize();
    // Second call: early return, no additional fetches.
    expect(BackendApi.getEarnPools).toHaveBeenCalledTimes(1);
  });

  it("initialize leaves initialized=false when pools are empty", async () => {
    BackendApi.getEarnPools.mockResolvedValueOnce([]);
    BackendApi.getEarnStats.mockResolvedValueOnce({
      total_deposited: "0",
      total_deposited_usd: "0",
      average_apy: 0,
      total_lenders: 0
    });
    BackendApi.getEtlPools.mockResolvedValueOnce({ protocols: [] });
    BackendApi.getSuppliedFunds.mockResolvedValueOnce({ total: "0" });

    const store = useEarnStore();
    await store.initialize();
    expect(store.initialized).toBe(false);
  });

  it("refresh fetches everything including positions when address is set", async () => {
    BackendApi.getEarnPools.mockResolvedValue([]);
    BackendApi.getEarnStats.mockResolvedValue({
      total_deposited: "0",
      total_deposited_usd: "0",
      average_apy: 0,
      total_lenders: 0
    });
    BackendApi.getEtlPools.mockResolvedValue({ protocols: [] });
    BackendApi.getSuppliedFunds.mockResolvedValue({ total: "0" });
    BackendApi.getEarnPositions.mockResolvedValue({ positions: [], total_deposited_usd: "0" });

    const store = useEarnStore();
    await store.setAddress("nolus1x");
    // setAddress already called getEarnPositions once via fetch. Reset counters to
    // isolate refresh behavior.
    BackendApi.getEarnPositions.mockClear();
    BackendApi.getEarnPools.mockClear();
    BackendApi.getEarnStats.mockClear();
    BackendApi.getEtlPools.mockClear();
    BackendApi.getSuppliedFunds.mockClear();

    await store.refresh();
    expect(BackendApi.getEarnPools).toHaveBeenCalledTimes(1);
    expect(BackendApi.getEarnStats).toHaveBeenCalledTimes(1);
    expect(BackendApi.getEtlPools).toHaveBeenCalledTimes(1);
    expect(BackendApi.getSuppliedFunds).toHaveBeenCalledTimes(1);
    expect(BackendApi.getEarnPositions).toHaveBeenCalledTimes(1);
  });

  it("refresh omits positions when no address is set", async () => {
    BackendApi.getEarnPools.mockResolvedValueOnce([]);
    BackendApi.getEarnStats.mockResolvedValueOnce({
      total_deposited: "0",
      total_deposited_usd: "0",
      average_apy: 0,
      total_lenders: 0
    });
    BackendApi.getEtlPools.mockResolvedValueOnce({ protocols: [] });
    BackendApi.getSuppliedFunds.mockResolvedValueOnce({ total: "0" });

    const store = useEarnStore();
    await store.refresh();
    expect(BackendApi.getEarnPositions).not.toHaveBeenCalled();
  });

  it("ws callback replaces positions when address matches", async () => {
    BackendApi.getEarnPositions.mockResolvedValueOnce({ positions: [], total_deposited_usd: "0" });

    const store = useEarnStore();
    await store.setAddress("nolus1x");
    expect(captured.onEarn).not.toBeNull();

    captured.onEarn!(
      "nolus1x",
      [
        {
          protocol: "p1",
          lpp_address: "l1",
          deposited_asset: "5",
          deposited_lpn: "5"
        }
      ],
      "5.0"
    );

    expect(store.positions.length).toBe(1);
    expect(store.positions[0]).toMatchObject({
      protocol: "p1",
      lpp_address: "l1",
      deposited_nlpn: "5",
      deposited_lpn: "5",
      deposited_usd: null,
      lpp_price: "1.0",
      current_apy: 0
    });
    expect(store.totalDepositedUsd).toBe("5.0");
  });

  it("ws callback ignores mismatched address", async () => {
    BackendApi.getEarnPositions.mockResolvedValueOnce({ positions: [], total_deposited_usd: "0" });

    const store = useEarnStore();
    await store.setAddress("nolus1x");

    captured.onEarn!(
      "nolus1OTHER",
      [
        {
          protocol: "p1",
          lpp_address: "l1",
          deposited_asset: "5",
          deposited_lpn: "5"
        }
      ],
      "999"
    );

    expect(store.positions).toEqual([]);
    expect(store.totalDepositedUsd).toBe("0");
  });

  it("cleanup unsubscribes and resets state", async () => {
    BackendApi.getEarnPositions.mockResolvedValueOnce({
      positions: [
        {
          protocol: "p",
          lpp_address: "l",
          currency: "USDC",
          deposited_nlpn: "1",
          deposited_lpn: "1",
          lpp_price: "1",
          current_apy: 0
        }
      ],
      total_deposited_usd: "1"
    });

    const store = useEarnStore();
    await store.setAddress("nolus1x");

    store.cleanup();
    expect(captured.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.address).toBeNull();
    expect(store.positions).toEqual([]);
    expect(store.totalDepositedUsd).toBe("0");
  });
});
