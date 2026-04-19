import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/common/api", () => ({
  BackendApi: {
    getStatsOverview: vi.fn(),
    getLoansStats: vi.fn(),
    getLeasedAssets: vi.fn(),
    getMonthlyLeases: vi.fn(),
    getSupplyBorrowHistory: vi.fn()
  }
}));

import { BackendApi } from "@/common/api";
import { useStatsStore } from "./index";

const api = BackendApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

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

function fullOverview() {
  return {
    tvl: { total_value_locked: "100" },
    tx_volume: { total_tx_value: "5000" },
    buyback_total: { buyback_total: "50" },
    realized_pnl_stats: { amount: "-10" },
    revenue: { revenue: "42" }
  };
}

describe("StatsStore", () => {
  it("initial_state_defaults", () => {
    const store = useStatsStore();
    expect(store.overview).toEqual({
      tvl: "0",
      txVolume: "0",
      buybackTotal: "0",
      realizedPnlStats: "0",
      revenue: "0"
    });
    expect(store.loansStats).toEqual({ openPositionValue: null, openInterest: null });
    expect(store.overviewLoading).toBe(false);
    expect(store.loansStatsLoading).toBe(false);
    expect(store.initialized).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.isLoading).toBe(false);
    expect(store.hasOverviewData).toBe(false);
    expect(store.hasLoansStats).toBe(false);
  });

  it("fetchOverview_populates_state_from_batch", async () => {
    api.getStatsOverview.mockResolvedValueOnce(fullOverview());
    const store = useStatsStore();
    await store.fetchOverview();
    expect(store.overview).toEqual({
      tvl: "100",
      txVolume: "5000",
      buybackTotal: "50",
      realizedPnlStats: "-10",
      revenue: "42"
    });
    expect(store.lastUpdated).toBeInstanceOf(Date);
    expect(store.hasOverviewData).toBe(true);
  });

  it("fetchOverview_handles_null_nested_fields", async () => {
    api.getStatsOverview.mockResolvedValueOnce({
      tvl: null,
      tx_volume: null,
      buyback_total: null,
      realized_pnl_stats: null,
      revenue: null
    });
    const store = useStatsStore();
    await store.fetchOverview();
    expect(store.overview).toEqual({
      tvl: "0",
      txVolume: "0",
      buybackTotal: "0",
      realizedPnlStats: "0",
      revenue: "0"
    });
    expect(store.hasOverviewData).toBe(false);
  });

  it("fetchOverview_sets_error_and_rethrows_on_failure", async () => {
    api.getStatsOverview.mockRejectedValueOnce(new Error("fetch blew up"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useStatsStore();
      await expect(store.fetchOverview()).rejects.toThrow("fetch blew up");
      expect(store.error).toBe("fetch blew up");
      expect(store.overviewLoading).toBe(false);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchLoansStats_populates", async () => {
    api.getLoansStats.mockResolvedValueOnce({
      open_position_value: { total: "200" },
      open_interest: { interest: "0.05" }
    });
    const store = useStatsStore();
    await store.fetchLoansStats();
    expect(store.loansStats.openPositionValue).toEqual({ total: "200" });
    expect(store.loansStats.openInterest).toEqual({ interest: "0.05" });
    expect(store.hasLoansStats).toBe(true);
  });

  it("fetchLoansStats_rethrows_on_failure", async () => {
    api.getLoansStats.mockRejectedValueOnce(new Error("down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useStatsStore();
      await expect(store.fetchLoansStats()).rejects.toThrow("down");
      expect(store.error).toBe("down");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("isLoading_true_when_any_loading_flag_set", async () => {
    // Hang the request so we can inspect state mid-flight.
    let resolveOverview: (v: unknown) => void = () => {};
    api.getStatsOverview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOverview = resolve;
        })
    );
    const store = useStatsStore();
    const promise = store.fetchOverview();
    expect(store.overviewLoading).toBe(true);
    expect(store.isLoading).toBe(true);
    resolveOverview(fullOverview());
    await promise;
    expect(store.isLoading).toBe(false);
  });

  it("hasOverviewData_true_when_tvl_not_zero", async () => {
    api.getStatsOverview.mockResolvedValueOnce({
      tvl: { total_value_locked: "1" },
      tx_volume: null,
      buyback_total: null,
      realized_pnl_stats: null,
      revenue: null
    });
    const store = useStatsStore();
    expect(store.hasOverviewData).toBe(false);
    await store.fetchOverview();
    expect(store.hasOverviewData).toBe(true);
  });

  it("hasLoansStats_true_when_open_position_value_set", async () => {
    api.getLoansStats.mockResolvedValueOnce({
      open_position_value: { foo: "bar" },
      open_interest: null
    });
    const store = useStatsStore();
    expect(store.hasLoansStats).toBe(false);
    await store.fetchLoansStats();
    expect(store.hasLoansStats).toBe(true);
  });

  it("initialize_calls_fetchers_and_sets_initialized", async () => {
    api.getStatsOverview.mockResolvedValueOnce(fullOverview());
    api.getLoansStats.mockResolvedValueOnce({
      open_position_value: { total: "1" },
      open_interest: { interest: "0.01" }
    });
    api.getLeasedAssets.mockResolvedValueOnce({ foo: "bar" });
    const store = useStatsStore();
    await store.initialize();
    expect(store.initialized).toBe(true);
    expect(api.getStatsOverview).toHaveBeenCalledTimes(1);
    expect(api.getLoansStats).toHaveBeenCalledTimes(1);
    expect(api.getLeasedAssets).toHaveBeenCalledTimes(1);
  });

  it("initialize_is_idempotent_when_already_initialized", async () => {
    api.getStatsOverview.mockResolvedValue(fullOverview());
    api.getLoansStats.mockResolvedValue({ open_position_value: null, open_interest: null });
    api.getLeasedAssets.mockResolvedValue({});
    const store = useStatsStore();
    await store.initialize();
    const countBefore = api.getStatsOverview.mock.calls.length;
    await store.initialize();
    expect(api.getStatsOverview.mock.calls.length).toBe(countBefore);
  });

  it("cleanup_resets_state", async () => {
    api.getStatsOverview.mockResolvedValueOnce(fullOverview());
    const store = useStatsStore();
    await store.fetchOverview();
    store.cleanup();
    expect(store.overview).toEqual({
      tvl: "0",
      txVolume: "0",
      buybackTotal: "0",
      realizedPnlStats: "0",
      revenue: "0"
    });
    expect(store.lastUpdated).toBeNull();
    expect(store.initialized).toBe(false);
  });
});
