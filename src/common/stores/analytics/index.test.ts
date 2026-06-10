import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/common/api", () => ({
  BackendApi: {
    getUserDashboard: vi.fn(),
    getUserHistory: vi.fn(),
    getEarnings: vi.fn(),
    getPositionDebtValue: vi.fn(),
    getHistoryStats: vi.fn(),
    getRealizedPnl: vi.fn(),
    getRealizedPnlData: vi.fn(),
    getPnlLog: vi.fn(),
    getPnlOverTime: vi.fn(),
    getPriceSeries: vi.fn()
  }
}));

import { BackendApi } from "@/common/api";
import { useAnalyticsStore } from "./index";

const api = BackendApi as unknown as Record<
  | "getUserDashboard"
  | "getUserHistory"
  | "getEarnings"
  | "getPositionDebtValue"
  | "getHistoryStats"
  | "getRealizedPnl"
  | "getRealizedPnlData"
  | "getPnlLog"
  | "getPnlOverTime"
  | "getPriceSeries",
  ReturnType<typeof vi.fn>
>;

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  for (const fn of Object.values(api)) {
    fn.mockReset();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function dashboardPayload() {
  return {
    earnings: { total: "100" },
    realized_pnl: { total: "-5" },
    position_debt_value: { value: "200" }
  };
}

function historyPayload() {
  return {
    history_stats: { count: 5 },
    realized_pnl_data: [{ x: 1 }]
  };
}

describe("AnalyticsStore", () => {
  it("initial_state_defaults", () => {
    const store = useAnalyticsStore();
    expect(store.address).toBeNull();
    expect(store.dashboardData).toEqual({
      earnings: null,
      realizedPnl: null,
      positionDebtValue: null
    });
    expect(store.historyData).toEqual({
      historyStats: null,
      realizedPnlData: null
    });
    expect(store.pnlOverTime).toEqual([]);
    expect(store.initialized).toBe(false);
    expect(store.dashboardLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.isConnected).toBe(false);
    expect(store.hasEarnings).toBe(false);
    expect(store.hasHistoryStats).toBe(false);
  });

  it("isConnected_true_when_address_set", () => {
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    expect(store.isConnected).toBe(true);
  });

  it("fetchDashboardData_noop_without_address", async () => {
    const store = useAnalyticsStore();
    await store.fetchDashboardData();
    expect(api.getUserDashboard).not.toHaveBeenCalled();
    expect(store.dashboardLoading).toBe(false);
  });

  it("fetchDashboardData_populates_state", async () => {
    api.getUserDashboard.mockResolvedValueOnce(dashboardPayload());
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchDashboardData();
    expect(store.dashboardData.earnings).toEqual({ total: "100" });
    expect(store.dashboardData.realizedPnl).toEqual({ total: "-5" });
    expect(store.dashboardData.positionDebtValue).toEqual({ value: "200" });
    expect(store.lastUpdated).toBeInstanceOf(Date);
    expect(store.hasEarnings).toBe(true);
  });

  it("fetchDashboardData_drops_response_when_address_changes_mid_flight", async () => {
    // Hang the API so we can race address changes against the in-flight response.
    let resolveDashboard: (v: unknown) => void = () => {};
    api.getUserDashboard.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDashboard = resolve;
        })
    );

    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    const inflight = store.fetchDashboardData();

    // Change address mid-flight — the guard should cause the response to be dropped.
    store.address = "nolus1xyz";

    resolveDashboard(dashboardPayload());
    await inflight;

    expect(store.dashboardData.earnings).toBeNull();
    expect(store.dashboardData.realizedPnl).toBeNull();
    expect(store.dashboardData.positionDebtValue).toBeNull();
  });

  it("fetchDashboardData_sets_error_and_rethrows", async () => {
    api.getUserDashboard.mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useAnalyticsStore();
      store.address = "nolus1abc";
      await expect(store.fetchDashboardData()).rejects.toThrow("boom");
      expect(store.error).toBe("boom");
      expect(store.dashboardLoading).toBe(false);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchEarnings_populates_earnings_field", async () => {
    api.getEarnings.mockResolvedValueOnce({ total: "999" });
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchEarnings();
    expect(store.dashboardData.earnings).toEqual({ total: "999" });
  });

  it("fetchEarnings_noop_without_address", async () => {
    const store = useAnalyticsStore();
    await store.fetchEarnings();
    expect(api.getEarnings).not.toHaveBeenCalled();
  });

  it("fetchPositionDebtValue_populates_field", async () => {
    api.getPositionDebtValue.mockResolvedValueOnce({ debt: "42" });
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchPositionDebtValue();
    expect(store.dashboardData.positionDebtValue).toEqual({ debt: "42" });
  });

  it("fetchHistoryData_populates_state", async () => {
    api.getUserHistory.mockResolvedValueOnce(historyPayload());
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchHistoryData();
    expect(store.historyData.historyStats).toEqual({ count: 5 });
    expect(store.historyData.realizedPnlData).toEqual([{ x: 1 }]);
    expect(store.hasHistoryStats).toBe(true);
  });

  it("fetchHistoryData_drops_response_on_address_change", async () => {
    let resolveHistory: (v: unknown) => void = () => {};
    api.getUserHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHistory = resolve;
        })
    );
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    const inflight = store.fetchHistoryData();
    store.address = "nolus1other";
    resolveHistory(historyPayload());
    await inflight;
    expect(store.historyData.historyStats).toBeNull();
    expect(store.historyData.realizedPnlData).toBeNull();
  });

  it("fetchHistoryData_keeps_null_realized_pnl_data", async () => {
    api.getUserHistory.mockResolvedValueOnce({
      history_stats: { count: 2 },
      realized_pnl_data: null
    });
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchHistoryData();
    expect(store.historyData.historyStats).toEqual({ count: 2 });
    expect(store.historyData.realizedPnlData).toBeNull();
  });

  it("fetchHistoryData_drops_non_array_realized_pnl_data", async () => {
    api.getUserHistory.mockResolvedValueOnce({
      history_stats: { count: 2 },
      realized_pnl_data: { address: "nolus1abc", trades: [] }
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useAnalyticsStore();
      store.address = "nolus1abc";
      await store.fetchHistoryData();
      expect(store.historyData.realizedPnlData).toBeNull();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchRealizedPnlData_populates_array_payload", async () => {
    api.getRealizedPnlData.mockResolvedValueOnce([{ pnl: "3" }]);
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchRealizedPnlData();
    expect(store.historyData.realizedPnlData).toEqual([{ pnl: "3" }]);
  });

  it("fetchRealizedPnl_populates_dashboard_field", async () => {
    api.getRealizedPnl.mockResolvedValueOnce({ realized_pnl: "-2" });
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchRealizedPnl();
    expect(store.dashboardData.realizedPnl).toEqual({ realized_pnl: "-2" });
  });

  it("fetchHistoryStats_populates_field", async () => {
    api.getHistoryStats.mockResolvedValueOnce({ open: 3 });
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchHistoryStats();
    expect(store.historyData.historyStats).toEqual({ open: 3 });
  });

  it("hasEarnings_hasHistoryStats_computed", async () => {
    const store = useAnalyticsStore();
    expect(store.hasEarnings).toBe(false);
    expect(store.hasHistoryStats).toBe(false);
    store.dashboardData.earnings = { total: "1" };
    store.historyData.historyStats = { n: 1 };
    expect(store.hasEarnings).toBe(true);
    expect(store.hasHistoryStats).toBe(true);
  });

  it("cleanup_clears_all_user_state", async () => {
    api.getUserDashboard.mockResolvedValueOnce(dashboardPayload());
    const store = useAnalyticsStore();
    store.address = "nolus1abc";
    await store.fetchDashboardData();
    store.cleanup();
    expect(store.address).toBeNull();
    expect(store.dashboardData.earnings).toBeNull();
    expect(store.historyData.historyStats).toBeNull();
    expect(store.pnlOverTime).toEqual([]);
    expect(store.lastUpdated).toBeNull();
    expect(store.error).toBeNull();
    expect(store.initialized).toBe(false);
  });

  it("fetchPriceSeries_caches_result", async () => {
    api.getPriceSeries.mockResolvedValueOnce([{ t: 1, p: "2" }]);
    const store = useAnalyticsStore();
    const first = await store.fetchPriceSeries("USDC", "OSMOSIS", "1d");
    const second = await store.fetchPriceSeries("USDC", "OSMOSIS", "1d");
    expect(first).toEqual([{ t: 1, p: "2" }]);
    expect(second).toEqual([{ t: 1, p: "2" }]);
    expect(api.getPriceSeries).toHaveBeenCalledTimes(1);
  });

  it("fetchPnlOverTime_populates_and_sets_error_on_failure", async () => {
    api.getPnlOverTime.mockResolvedValueOnce([{ t: 1 }]);
    const store = useAnalyticsStore();
    await store.fetchPnlOverTime("nolus1lease", "7");
    expect(store.pnlOverTime).toEqual([{ t: 1 }]);
    expect(store.lastUpdated).toBeInstanceOf(Date);

    api.getPnlOverTime.mockRejectedValueOnce(new Error("bad"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(store.fetchPnlOverTime("nolus1lease", "7")).rejects.toThrow("bad");
      expect(store.error).toBe("bad");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
