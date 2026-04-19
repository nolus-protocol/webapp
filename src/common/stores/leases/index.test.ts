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
    onLeases: ((lease: any) => void) | null;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = { onLeases: null, unsubscribe: vi.fn() };

  const BackendApi = {
    getLeases: vi.fn(),
    getLease: vi.fn(),
    getLeaseHistory: vi.fn(),
    getLeaseQuote: vi.fn()
  };

  const subscribeLeases = vi.fn((_addr: string, cb: (lease: any) => void) => {
    captured.onLeases = cb;
    return captured.unsubscribe;
  });

  return { captured, BackendApi, subscribeLeases };
});

vi.mock("@/common/api", () => ({
  BackendApi: hoisted.BackendApi,
  WebSocketClient: {
    subscribeLeases: hoisted.subscribeLeases
  }
}));

// Prices & config stubs — keep them controllable per test.
const pricesState = {
  getPriceAsNumber: vi.fn((_k: string) => 0)
};
vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => pricesState
}));

const configState = {
  currenciesData: {} as Record<string, { key: string; decimal_digits: number; ticker?: string; protocol?: string }>,
  getPositionType: vi.fn((_p: string) => "Long" as "Long" | "Short")
};
vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => configState
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getLpnByProtocol: (_p: string) => null
}));

// LeaseCalculator has heavy numeric logic tested in its own file (Phase 1).
// Stub it to a minimal shape that returns deterministic placeholders so we
// can exercise the store wiring around getLeaseDisplayData.
vi.mock("@/common/utils", async () => {
  const { Dec } = await import("@keplr-wallet/unit");
  class StubCalc {
    constructor(..._args: unknown[]) {}
    calculateDisplayData() {
      return {
        lease: {},
        totalDebt: new Dec(0),
        totalDebtUsd: new Dec(0),
        interestDue: new Dec(0),
        interestRate: new Dec(0),
        interestRateMonthly: new Dec(0),
        liquidationPrice: new Dec(0),
        health: 0,
        healthStatus: "green",
        pnlAmount: new Dec(0),
        pnlPercent: new Dec(0),
        pnlPositive: true,
        assetValueUsd: new Dec(0),
        positionType: "long",
        stopLoss: null,
        takeProfit: null,
        interestDueWarning: false,
        interestDueDate: null,
        downPayment: new Dec(0),
        openingPrice: new Dec(0),
        fee: new Dec(0),
        repaymentValue: new Dec(0),
        inProgressType: null,
        unitAsset: new Dec(0),
        stableAsset: new Dec(0)
      };
    }
    static calculateTotalPnl() {
      return new Dec(0);
    }
  }
  return { LeaseCalculator: StubCalc };
});

const connectionState = {
  walletAddress: null as string | null,
  wsReconnectCount: 0
};
vi.mock("@/common/stores/connection", () => ({
  useConnectionStore: () => connectionState
}));

import { useLeasesStore } from "./index";

const { captured, BackendApi, subscribeLeases } = hoisted;

type LeaseRec = {
  address: string;
  protocol: string;
  status: "opening" | "opened" | "paid_off" | "closing" | "closed" | "liquidated";
  amount: { ticker: string; amount: string };
  debt: {
    ticker: string;
    principal: string;
    overdue_margin: string;
    overdue_interest: string;
    due_margin: string;
    due_interest: string;
    total: string;
  };
  interest: { loan_rate: number; margin_rate: number; annual_rate_percent: number };

  in_progress?: any;
};

const mkLease = (o: Partial<LeaseRec>): LeaseRec => ({
  address: "nolus1l1",
  protocol: "osmosis-noble",
  status: "opened",
  amount: { ticker: "ATOM", amount: "1000000" },
  debt: {
    ticker: "USDC",
    principal: "0",
    overdue_margin: "0",
    overdue_interest: "0",
    due_margin: "0",
    due_interest: "0",
    total: "0"
  },
  interest: { loan_rate: 0, margin_rate: 0, annual_rate_percent: 0 },
  ...o
});

describe("useLeasesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    captured.onLeases = null;
    captured.unsubscribe = vi.fn();
    subscribeLeases.mockImplementation((_addr, cb) => {
      captured.onLeases = cb;
      return captured.unsubscribe;
    });
    connectionState.walletAddress = null;
    connectionState.wsReconnectCount = 0;
    pricesState.getPriceAsNumber = vi.fn(() => 0);
    configState.currenciesData = {};
    configState.getPositionType = vi.fn(() => "Long");
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state defaults", () => {
    const store = useLeasesStore();
    expect(store.leases).toEqual([]);
    expect(store.owner).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.hasLeases).toBe(false);
    expect(store.leaseCount).toBe(0);
    expect(store.openLeases).toEqual([]);
    expect(store.closedLeases).toEqual([]);
  });

  it("hasLeases and leaseCount react to leases", () => {
    const store = useLeasesStore();

    (store.leases as any).push(mkLease({}));
    expect(store.hasLeases).toBe(true);
    expect(store.leaseCount).toBe(1);
  });

  it("openLeases and closedLeases filter by status", () => {
    const store = useLeasesStore();

    (store.leases as any).push(
      mkLease({ address: "o1", status: "opened" }),
      mkLease({ address: "o2", status: "opening" }),
      mkLease({ address: "c1", status: "closed" }),
      mkLease({ address: "c2", status: "closing" }),
      mkLease({ address: "c3", status: "paid_off" }),
      mkLease({ address: "c4", status: "liquidated" })
    );

    expect(store.openLeases.map((l) => l.address).sort()).toEqual(["o1", "o2"]);
    expect(store.closedLeases.map((l) => l.address).sort()).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("getLease finds in leases array first, then falls back to leaseDetails cache", async () => {
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1" })]);
    const store = useLeasesStore();
    await store.setOwner("nolus1x");

    expect(store.getLease("l1")?.address).toBe("l1");
    expect(store.getLease("missing")).toBeUndefined();

    // Now mutate leases array to empty and ensure leaseDetails cache still hits.

    (store.leases as any).splice(0, store.leases.length);
    expect(store.getLease("l1")?.address).toBe("l1");
  });

  it("getLeaseHistory returns cached entries or empty array", async () => {
    BackendApi.getLeaseHistory.mockResolvedValueOnce([{ action: "open", amount: "1" }]);
    const store = useLeasesStore();
    expect(store.getLeaseHistory("l1")).toEqual([]);
    const hist = await store.fetchLeaseHistory("l1");
    expect(hist).toEqual([{ action: "open", amount: "1" }]);
    expect(store.getLeaseHistory("l1")).toEqual([{ action: "open", amount: "1" }]);
  });

  it("fetchLeases is a no-op without owner", async () => {
    const store = useLeasesStore();
    await store.fetchLeases();
    expect(BackendApi.getLeases).not.toHaveBeenCalled();
  });

  it("fetchLeases populates and sets lastUpdated on success", async () => {
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1" })]);
    const store = useLeasesStore();
    await store.setOwner("nolus1x");

    expect(store.leases.length).toBe(1);
    expect(store.lastUpdated).toBeInstanceOf(Date);
  });

  it("fetchLeases preserves transitional leases missing from backend", async () => {
    const store = useLeasesStore();
    // First call: seed leases array with a local opening lease.
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "local1", status: "opening" })]);
    await store.setOwner("nolus1x");
    expect(store.leases.map((l) => l.address)).toContain("local1");

    // Second fetch: backend returns empty. Opening lease must be preserved.
    BackendApi.getLeases.mockResolvedValueOnce([]);
    await store.fetchLeases();
    expect(store.leases.map((l) => l.address)).toContain("local1");
  });

  it("fetchLeases does NOT preserve opened leases missing from backend", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "gone", status: "opened" })]);
    await store.setOwner("nolus1x");
    expect(store.leases.length).toBe(1);

    BackendApi.getLeases.mockResolvedValueOnce([]);
    await store.fetchLeases();
    expect(store.leases.length).toBe(0);
  });

  it("fetchLeases merges cached with advanced status over stale backend", async () => {
    const store = useLeasesStore();
    // Seed cache with an opened lease.
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    // Second fetch: backend regresses status to opening. Cache version must win.
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opening" })]);
    await store.fetchLeases();

    expect(store.leases.find((l) => l.address === "l1")?.status).toBe("opened");
  });

  it("fetchLeases preserves optimistic in_progress when backend catches up without it", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([
      mkLease({ address: "l1", status: "opened", in_progress: { close: {} } })
    ]);
    await store.setOwner("nolus1x");

    // Backend returns same address, same status, but no in_progress → cached in_progress preserved.
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.fetchLeases();

    const lease = store.leases.find((l) => l.address === "l1");
    expect(lease?.in_progress).toEqual({ close: {} });
  });

  it("fetchLeases sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getLeases.mockRejectedValueOnce(new Error("offline"));

    const store = useLeasesStore();
    await store.setOwner("nolus1x");
    expect(store.error).toBe("offline");

    spy.mockRestore();
  });

  it("fetchLeaseDetails regression guard returns cached when backend would regress", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    BackendApi.getLease.mockResolvedValueOnce(mkLease({ address: "l1", status: "opening" }));
    const result = await store.fetchLeaseDetails("l1");
    expect(result?.status).toBe("opened");
  });

  it("fetchLeaseDetails updates existing lease in main list", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    BackendApi.getLease.mockResolvedValueOnce(mkLease({ address: "l1", status: "closed" }));
    const result = await store.fetchLeaseDetails("l1");
    expect(result?.status).toBe("closed");
    expect(store.leases.find((l) => l.address === "l1")?.status).toBe("closed");
  });

  it("fetchLeaseDetails adds new lease when not in list and owner set", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([]);
    await store.setOwner("nolus1x");

    BackendApi.getLease.mockResolvedValueOnce(mkLease({ address: "new1", status: "opened" }));
    await store.fetchLeaseDetails("new1");
    expect(store.leases.find((l) => l.address === "new1")).toBeDefined();
  });

  it("fetchLeaseDetails returns null and sets error state on failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getLease.mockRejectedValueOnce(new Error("detail fail"));

    const store = useLeasesStore();
    const result = await store.fetchLeaseDetails("l1");
    expect(result).toBeNull();
    expect(store.error).toBe("detail fail");

    spy.mockRestore();
  });

  it("fetchLeaseHistory populates leaseHistories cache", async () => {
    const hist = [{ action: "open" }, { action: "close" }];
    BackendApi.getLeaseHistory.mockResolvedValueOnce(hist);
    const store = useLeasesStore();

    const result = await store.fetchLeaseHistory("l1", 0, 10);
    expect(result).toEqual(hist);
    expect(BackendApi.getLeaseHistory).toHaveBeenCalledWith("l1", 0, 10);
    expect(store.getLeaseHistory("l1")).toEqual(hist);
  });

  it("fetchLeaseHistory returns empty array on error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getLeaseHistory.mockRejectedValueOnce(new Error("hist down"));

    const store = useLeasesStore();
    const result = await store.fetchLeaseHistory("l1");
    expect(result).toEqual([]);
    expect(store.error).toBe("hist down");

    spy.mockRestore();
  });

  it("markLeaseInProgress sets close in_progress", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    store.markLeaseInProgress("l1", "close");
    expect(store.leases.find((l) => l.address === "l1")?.in_progress).toEqual({ close: {} });
  });

  it("markLeaseInProgress sets repayment in_progress", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    store.markLeaseInProgress("l1", "repayment");
    expect(store.leases.find((l) => l.address === "l1")?.in_progress).toEqual({ repayment: {} });
  });

  it("markLeaseInProgress is a no-op when lease is missing", () => {
    const store = useLeasesStore();
    expect(() => store.markLeaseInProgress("missing", "close")).not.toThrow();
    expect(store.leases).toEqual([]);
  });

  it("getQuote delegates to BackendApi.getLeaseQuote", async () => {
    BackendApi.getLeaseQuote.mockResolvedValueOnce({
      borrow: { ticker: "USDC", amount: "500" },
      annual_interest_rate: "0.1",
      annual_interest_rate_margin: "0.02",
      total_amount: { ticker: "ATOM", amount: "1000" },
      loan_to_deposit: "0.5"
    });

    const store = useLeasesStore();
    const req = { protocol: "p", downpayment: { ticker: "ATOM", amount: "1" }, lease_currency: "ATOM" };
    const result = await store.getQuote(req);
    expect(BackendApi.getLeaseQuote).toHaveBeenCalledWith(req);
    expect(result.borrow.amount).toBe("500");
  });

  it("ws callback merges partial update into existing lease", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    expect(captured.onLeases).not.toBeNull();
    captured.onLeases!({ address: "l1", status: "opened", amount: { ticker: "ATOM", amount: "9999" } });

    const lease = store.leases.find((l) => l.address === "l1");
    expect(lease?.amount.amount).toBe("9999");
  });

  it("ws callback regression guard ignores stale event", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1", status: "opened" })]);
    await store.setOwner("nolus1x");

    // Send a regressing status via WS — store should ignore it.
    captured.onLeases!(mkLease({ address: "l1", status: "opening" }));

    expect(store.leases.find((l) => l.address === "l1")?.status).toBe("opened");
  });

  it("ws callback adds new lease when absent", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([]);
    await store.setOwner("nolus1x");

    captured.onLeases!(mkLease({ address: "new1", status: "opened" }));
    expect(store.leases.find((l) => l.address === "new1")).toBeDefined();
  });

  it("refresh calls fetchLeases", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([]);
    await store.setOwner("nolus1x");
    BackendApi.getLeases.mockClear();

    BackendApi.getLeases.mockResolvedValueOnce([]);
    await store.refresh();
    expect(BackendApi.getLeases).toHaveBeenCalledTimes(1);
  });

  it("cleanup unsubscribes and resets state", async () => {
    const store = useLeasesStore();
    BackendApi.getLeases.mockResolvedValueOnce([mkLease({ address: "l1" })]);
    await store.setOwner("nolus1x");

    store.cleanup();
    expect(captured.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.owner).toBeNull();
    expect(store.leases).toEqual([]);
  });
});
