import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// jsdom doesn't implement matchMedia; ThemeManager (loaded via the utils barrel
// during history's import chain) reads it at module load. vi.hoisted() runs
// before vi.mock hoists, so we can patch window before any imports resolve.
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false
      })
    });
  }
});

// Mock heavy dependencies so the store can be tested in isolation.
// - @/common/api: BackendApi is a bag of vi.fn() stubs.
// - @/modules/history/common: message/action/icon are trivial stubs so we
//   can drive transformTransactions without pulling the full translation path.
// - @nolus/nolusjs CurrencyUtils + utils/NumberFormatUtils: provide simple
//   shims that return deterministic values for the addPendingTransfer path.
vi.mock("@/common/api", () => ({
  BackendApi: {
    getTransactions: vi.fn()
  }
}));

vi.mock("@/modules/history/common", () => ({
  message: vi.fn(async () => ["msg", { amount: "1" }, { steps: [], activeStep: 0 }, { steps: [], activeStep: 0 }]),
  action: vi.fn(() => "Transfer"),
  icon: vi.fn(() => "transfer")
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatCoinPretty: vi.fn(() => "1 USDC"),
  formatTokenBalance: vi.fn(() => "1")
}));

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertMinimalDenomToDenom: vi.fn(() => ({ amount: "1", denom: "USDC" }))
  }
}));

vi.mock("@/common/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/common/utils")>();
  return {
    ...actual,
    getCreatedAtForHuman: vi.fn(() => "just now"),
    StringUtils: {
      ...actual.StringUtils,
      truncateString: vi.fn((s: string) => s.slice(0, 12))
    }
  };
});

// i18n is a module-level singleton; the store only uses i18n.global.t for
// vote messages during transaction fetches. Keep it as a thin stub.
vi.mock("@/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => key
    }
  }
}));

import { BackendApi } from "@/common/api";
import { CONFIRM_STEP } from "@/common/types";
import { HISTORY_ACTIONS } from "@/modules/history/types";
import { useHistoryStore } from "./index";
import { useConfigStore } from "@/common/stores/config";

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

// -----------------------------------------------------------------------------
// A minimal skipRoute payload that addPendingTransfer's getRouteSteps tolerates.
// It is intentionally small — operations=[] means zero steps are emitted.
// -----------------------------------------------------------------------------
function baseSkipRoute() {
  return { operations: [] };
}

function baseReceivePayload() {
  return {
    id: 1,
    type: HISTORY_ACTIONS.RECEIVE,
    currency: "ibc/USDC",
    fromAddress: "nolus1fromaddressverylong",
    skipRoute: { ...baseSkipRoute(), amountOut: "1000000" },
    chains: {}
  };
}

function baseSendPayload() {
  return {
    id: 2,
    type: HISTORY_ACTIONS.SEND,
    currency: "ibc/USDC",
    receiverAddress: "nolus1toaddressverylong",
    skipRoute: { ...baseSkipRoute(), amountIn: "1000000" },
    chains: {}
  };
}

// A minimal i18n shim — addPendingTransfer only calls .t(key, params).
const i18nInstance = {
  t: (key: string, _params?: Record<string, unknown>) => key
} as unknown as Record<string, unknown>;

describe("HistoryStore", () => {
  // ---------------------------------------------------------------------------
  // Initial state + computed
  // ---------------------------------------------------------------------------
  it("initial_state_defaults", () => {
    const store = useHistoryStore();
    expect(store.pendingTransfers).toEqual({});
    expect(store.activities).toEqual({ data: [], loaded: false });
    expect(store.transactions).toEqual([]);
    expect(store.transactionsLoaded).toBe(false);
    expect(store.transactionsLoading).toBe(false);
    expect(store.address).toBeNull();
    expect(store.initialized).toBe(false);
    expect(store.hasPendingTransfers).toBe(false);
    expect(store.activitiesLoaded).toBe(false);
    expect(store.allTransactionsLoaded).toBe(false);
    expect(store.pendingTransfersList).toEqual([]);
  });

  it("hasPendingTransfers_computed", () => {
    const store = useHistoryStore();
    expect(store.hasPendingTransfers).toBe(false);
    store.pendingTransfers["1"] = { historyData: { id: 1 } } as unknown as (typeof store.pendingTransfers)[string];
    expect(store.hasPendingTransfers).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // addPendingTransfer — send + receive paths
  // ---------------------------------------------------------------------------
  it("addPendingTransfer_receive_builds_entry", () => {
    // Seed the config store so getCurrencyByDenom returns a currency.
    const configStore = useConfigStore();
    configStore.currenciesResponse = {
      currencies: {
        "USDC@OSMOSIS": {
          key: "USDC@OSMOSIS",
          ticker: "USDC",
          protocol: "OSMOSIS",
          symbol: "USDC",
          shortName: "USDC",
          ibcData: "ibc/USDC",
          decimal_digits: 6,
          group: "lease",
          native: false
        }
      },
      lpn: [],
      lease_currencies: [],
      map: {}
    } as unknown as typeof configStore.currenciesResponse;

    const store = useHistoryStore();
    store.addPendingTransfer(baseReceivePayload(), i18nInstance);

    const entry = store.pendingTransfers["1"];
    expect(entry).toBeDefined();
    expect(entry.historyData.status).toBe(CONFIRM_STEP.PENDING);
    expect(entry.historyData.icon).toBe("assets");
  });

  it("addPendingTransfer_send_builds_entry", () => {
    const configStore = useConfigStore();
    configStore.currenciesResponse = {
      currencies: {
        "USDC@OSMOSIS": {
          key: "USDC@OSMOSIS",
          ticker: "USDC",
          protocol: "OSMOSIS",
          symbol: "USDC",
          shortName: "USDC",
          ibcData: "ibc/USDC",
          decimal_digits: 6,
          group: "lease"
        }
      },
      lpn: [],
      lease_currencies: [],
      map: {}
    } as unknown as typeof configStore.currenciesResponse;

    const store = useHistoryStore();
    store.addPendingTransfer(baseSendPayload(), i18nInstance);

    const entry = store.pendingTransfers["2"];
    expect(entry).toBeDefined();
    expect(entry.historyData.status).toBe(CONFIRM_STEP.PENDING);
  });

  it("getPendingTransfer_lookup", () => {
    const store = useHistoryStore();
    const configStore = useConfigStore();
    configStore.currenciesResponse = {
      currencies: {},
      lpn: [],
      lease_currencies: [],
      map: {}
    } as unknown as typeof configStore.currenciesResponse;

    store.addPendingTransfer(baseReceivePayload(), i18nInstance);
    expect(store.getPendingTransfer("1")).toBeDefined();
    expect(store.getPendingTransfer("999")).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Status / step transitions on pending transfers
  // ---------------------------------------------------------------------------
  it("updatePendingTransferStatus_updates_status", () => {
    const store = useHistoryStore();
    const configStore = useConfigStore();
    configStore.currenciesResponse = {
      currencies: {},
      lpn: [],
      lease_currencies: [],
      map: {}
    } as unknown as typeof configStore.currenciesResponse;
    store.addPendingTransfer(baseReceivePayload(), i18nInstance);

    store.updatePendingTransferStatus("1", CONFIRM_STEP.SUCCESS);
    expect(store.pendingTransfers["1"].historyData.status).toBe(CONFIRM_STEP.SUCCESS);
  });

  it("updatePendingTransferStatus_noop_when_id_missing", () => {
    const store = useHistoryStore();
    // Must not throw.
    store.updatePendingTransferStatus("does-not-exist", CONFIRM_STEP.SUCCESS);
    expect(store.pendingTransfers["does-not-exist"]).toBeUndefined();
  });

  it("incrementPendingTransferStep_advances_step", () => {
    const store = useHistoryStore();
    // Manually plant a minimal entry so we don't need the full addPendingTransfer path.
    store.pendingTransfers["1"] = {
      historyData: {
        id: 1,
        route: { steps: [{}, {}], activeStep: 0 },
        routeDetails: { steps: [{}, {}], activeStep: 0 }
      }
    } as unknown as (typeof store.pendingTransfers)[string];

    store.incrementPendingTransferStep("1");
    expect(store.pendingTransfers["1"].historyData.route.activeStep).toBe(1);
    expect(store.pendingTransfers["1"].historyData.routeDetails.activeStep).toBe(1);
  });

  it("completePendingTransfer_sets_success", () => {
    const store = useHistoryStore();
    store.pendingTransfers["1"] = {
      historyData: {
        id: 1,
        route: { steps: [{}, {}], activeStep: 0 },
        routeDetails: { steps: [{}, {}], activeStep: 0 }
      }
    } as unknown as (typeof store.pendingTransfers)[string];

    store.completePendingTransfer("1");
    expect(store.pendingTransfers["1"].historyData.status).toBe(CONFIRM_STEP.SUCCESS);
    expect(store.pendingTransfers["1"].historyData.route.activeStep).toBe(2);
  });

  it("failPendingTransfer_sets_error_and_marks_step_failed", () => {
    const store = useHistoryStore();
    store.pendingTransfers["1"] = {
      historyData: {
        id: 1,
        route: { steps: [{ status: "ok" }, { status: "ok" }], activeStep: 0 },
        routeDetails: { steps: [{ status: "ok" }, { status: "ok" }], activeStep: 0 }
      }
    } as unknown as (typeof store.pendingTransfers)[string];

    store.failPendingTransfer("1", "nope");
    const h = store.pendingTransfers["1"].historyData;
    expect(h.status).toBe(CONFIRM_STEP.ERROR);
    expect(h.errorMsg).toBe("nope");
    expect(h.route.steps[0].status).toBe("failed");
    expect(h.routeDetails.steps[0].status).toBe("failed");
  });

  it("setTransferTxHashes_and_removePendingTransfer_and_clearPendingTransfers", () => {
    const store = useHistoryStore();
    store.pendingTransfers["1"] = {
      historyData: { id: 1 }
    } as unknown as (typeof store.pendingTransfers)[string];
    store.pendingTransfers["2"] = {
      historyData: { id: 2 }
    } as unknown as (typeof store.pendingTransfers)[string];

    store.setTransferTxHashes("1", ["0xabc"]);
    expect(store.pendingTransfers["1"].historyData.txHashes).toEqual(["0xabc"]);

    store.removePendingTransfer("1");
    expect(store.pendingTransfers["1"]).toBeUndefined();
    expect(store.pendingTransfers["2"]).toBeDefined();

    store.clearPendingTransfers();
    expect(store.pendingTransfers).toEqual({});
  });

  it("pendingTransfersList_sorted_by_id_desc", () => {
    const store = useHistoryStore();
    store.pendingTransfers["1"] = {
      historyData: { id: 1 }
    } as unknown as (typeof store.pendingTransfers)[string];
    store.pendingTransfers["3"] = {
      historyData: { id: 3 }
    } as unknown as (typeof store.pendingTransfers)[string];
    store.pendingTransfers["2"] = {
      historyData: { id: 2 }
    } as unknown as (typeof store.pendingTransfers)[string];

    const ids = store.pendingTransfersList.map((t) => t.historyData.id);
    expect(ids).toEqual([3, 2, 1]);
  });

  // ---------------------------------------------------------------------------
  // Transactions fetching
  // ---------------------------------------------------------------------------
  it("fetchTransactions_returns_empty_without_address", async () => {
    const store = useHistoryStore();
    const result = await store.fetchTransactions();
    expect(result).toEqual([]);
    expect(store.transactions).toEqual([]);
    expect(api.getTransactions).not.toHaveBeenCalled();
  });

  it("fetchTransactions_populates_state_on_success", async () => {
    api.getTransactions.mockResolvedValueOnce([
      { id: "a", timestamp: "2024-01-01T00:00:00Z", type: "send" },
      { id: "b", timestamp: "2024-01-02T00:00:00Z", type: "send" }
    ]);
    const store = useHistoryStore();
    store.address = "nolus1abc";
    const res = await store.fetchTransactions(0, 50);
    expect(res.length).toBe(2);
    expect(store.transactions.length).toBe(2);
    // Fewer than limit → all transactions loaded flag flipped.
    expect(store.transactionsLoaded).toBe(true);
  });

  it("fetchTransactions_sets_error_on_failure", async () => {
    api.getTransactions.mockRejectedValueOnce(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.address = "nolus1abc";
      await expect(store.fetchTransactions(0, 50)).rejects.toThrow("boom");
      expect(store.transactionsLoading).toBe(false);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchTransactions_refresh_replaces_existing", async () => {
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const store = useHistoryStore();
    store.address = "nolus1abc";
    await store.fetchTransactions(0, 50);
    expect(store.transactions.length).toBe(1);

    api.getTransactions.mockResolvedValueOnce([
      { id: "b", timestamp: "2024-01-02T00:00:00Z" },
      { id: "c", timestamp: "2024-01-03T00:00:00Z" }
    ]);
    await store.fetchTransactions(0, 50, {}, true);
    expect(store.transactions.length).toBe(2);
  });

  it("resetTransactions_clears_list", async () => {
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const store = useHistoryStore();
    store.address = "nolus1abc";
    await store.fetchTransactions(0, 50);
    expect(store.transactions.length).toBe(1);

    store.resetTransactions();
    expect(store.transactions).toEqual([]);
    expect(store.transactionsLoaded).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Activities lifecycle
  // ---------------------------------------------------------------------------
  it("loadActivities_noop_without_address", async () => {
    const store = useHistoryStore();
    await store.loadActivities();
    expect(store.activities.loaded).toBe(true);
    expect(store.activities.data).toEqual([]);
  });

  it("loadActivities_populates_on_success", async () => {
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const store = useHistoryStore();
    store.address = "nolus1abc";
    await store.loadActivities();
    expect(store.activities.loaded).toBe(true);
    expect(store.activities.data.length).toBe(1);
  });

  it("loadActivities_swallows_errors_and_marks_loaded", async () => {
    api.getTransactions.mockRejectedValueOnce(new Error("nope"));
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.address = "nolus1abc";
      await store.loadActivities();
      // Error path marks `loaded = true` without re-throwing.
      expect(store.activities.loaded).toBe(true);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  it("initialize_sets_address_and_loads_activities", async () => {
    api.getTransactions.mockResolvedValueOnce([]);
    const store = useHistoryStore();
    await store.initialize("nolus1abc");
    expect(store.address).toBe("nolus1abc");
    expect(store.initialized).toBe(true);
  });

  it("setAddress_null_triggers_cleanup", async () => {
    api.getTransactions.mockResolvedValue([]);
    const store = useHistoryStore();
    await store.initialize("nolus1abc");
    store.pendingTransfers["1"] = {
      historyData: { id: 1 }
    } as unknown as (typeof store.pendingTransfers)[string];

    store.setAddress(null);
    expect(store.address).toBeNull();
    expect(store.initialized).toBe(false);
    expect(store.pendingTransfers).toEqual({});
    expect(store.activities.data).toEqual([]);
  });
});
