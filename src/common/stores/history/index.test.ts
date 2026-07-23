import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as CommonUtils from "@/common/utils";
import type * as DateParser from "@/common/utils/dateParser";
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

// The store reaches getCreatedAtForHuman through the barrel, but the barrel mock
// below does not intercept the store's copy — mock the deep module the barrel
// re-exports so both the store and this file share one mock instance.
vi.mock("@/common/utils/dateParser", async (importOriginal) => {
  const actual = await importOriginal<typeof DateParser>();
  return {
    ...actual,
    getCreatedAtForHuman: vi.fn(() => "just now")
  };
});

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertMinimalDenomToDenom: vi.fn(() => ({ amount: "1", denom: "USDC" }))
  }
}));

vi.mock("@/common/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof CommonUtils>();
  return {
    ...actual,
    TextFormat: {
      ...actual.TextFormat,
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
import type { CurrencyInfo } from "@/common/api";
import { getCreatedAtForHuman } from "@/common/utils/dateParser";
import { CONFIRM_STEP } from "@/common/types";
import { HISTORY_ACTIONS } from "@/modules/history/types";
import { message } from "@/modules/history/common";
import type { TransactionEntry } from "@/modules/history/types/ITransaction";
import { CoinPretty, Dec } from "@keplr-wallet/unit";
import { useHistoryStore } from "./index";
import { useConfigStore } from "@/common/stores/config";

const api = BackendApi as unknown as { getTransactions: ReturnType<typeof vi.fn> };

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  for (const fn of Object.values(api)) {
    fn.mockReset();
  }
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
    skipRoute: { ...baseSkipRoute(), amount_out: "1000000" },
    chains: {}
  };
}

function baseSendPayload() {
  return {
    id: 2,
    type: HISTORY_ACTIONS.SEND,
    currency: "ibc/USDC",
    receiverAddress: "nolus1toaddressverylong",
    skipRoute: { ...baseSkipRoute(), amount_in: "1000000" },
    chains: {}
  };
}

function usdcCurrency(): CurrencyInfo {
  return {
    key: "USDC@OSMOSIS",
    ticker: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    shortName: "USDC",
    decimal_digits: 6,
    ibcData: "ibc/USDC",
    dexSymbol: "USDC",
    icon: "usdc.svg",
    native: false,
    coingeckoId: null,
    protocol: "OSMOSIS",
    group: "lease",
    isActive: true
  };
}

function seedConfigCurrencies() {
  const configStore = useConfigStore();
  configStore.currenciesResponse = {
    currencies: { "USDC@OSMOSIS": usdcCurrency() },
    lpn: [],
    lease_currencies: [],
    map: {}
  };
}

// A fully-typed pending entry without route steppers, for guard-branch tests.
function plantedEntry(id: string): TransactionEntry {
  return {
    historyData: {
      id,
      msg: "planted",
      action: "transfer",
      icon: "assets",
      timestamp: "just now",
      coin: new CoinPretty({ coinDenom: "USDC", coinMinimalDenom: "ibc/USDC", coinDecimals: 6 }, new Dec(1))
    }
  };
}

// A minimal i18n shim — addPendingTransfer only calls .t(key, params).
const i18nInstance: { t: unknown } = {
  t: (...args: unknown[]) => args[0]
};

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
    store.pendingTransfers["1"] = plantedEntry("1");
    expect(store.hasPendingTransfers).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // addPendingTransfer — send + receive paths
  // ---------------------------------------------------------------------------
  it("addPendingTransfer_receive_builds_entry", () => {
    // Seed the config store so getCurrencyByDenom returns a currency.
    seedConfigCurrencies();

    const store = useHistoryStore();
    store.addPendingTransfer(baseReceivePayload(), i18nInstance);

    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
    expect(entry.historyData.status).toBe(CONFIRM_STEP.PENDING);
    expect(entry.historyData.icon).toBe("assets");
  });

  it("addPendingTransfer_send_builds_entry", () => {
    seedConfigCurrencies();

    const store = useHistoryStore();
    store.addPendingTransfer(baseSendPayload(), i18nInstance);

    const entry = store.pendingTransfers["2"];
    if (entry === undefined) throw new Error("expected pending transfer 2 to be created");
    expect(entry.historyData.status).toBe(CONFIRM_STEP.PENDING);
  });

  it("getPendingTransfer_lookup", () => {
    const store = useHistoryStore();
    store.addPendingTransfer(baseReceivePayload(), i18nInstance);
    expect(store.getPendingTransfer("1")).toBeDefined();
    expect(store.getPendingTransfer("999")).toBeUndefined();
  });

  it("addPendingTransfer_throws_without_t", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer(baseReceivePayload(), { t: undefined })).toThrow("i18n");
  });

  it("addPendingTransfer_throws_without_id", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer({ ...baseReceivePayload(), id: undefined }, i18nInstance)).toThrow(
      "missing an id"
    );
  });

  it("addPendingTransfer_throws_without_skip_route", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer({ ...baseReceivePayload(), skipRoute: undefined }, i18nInstance)).toThrow(
      "skip route"
    );
  });

  it("addPendingTransfer_receive_throws_without_amount_out", () => {
    const store = useHistoryStore();
    expect(() =>
      store.addPendingTransfer({ ...baseReceivePayload(), skipRoute: baseSkipRoute() }, i18nInstance)
    ).toThrow("amount_out");
  });

  it("addPendingTransfer_receive_throws_without_fromAddress", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer({ ...baseReceivePayload(), fromAddress: undefined }, i18nInstance)).toThrow(
      "sender address"
    );
  });

  it("addPendingTransfer_send_throws_without_amount_in", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer({ ...baseSendPayload(), skipRoute: baseSkipRoute() }, i18nInstance)).toThrow(
      "amount_in"
    );
  });

  it("addPendingTransfer_send_throws_without_receiverAddress", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer({ ...baseSendPayload(), receiverAddress: undefined }, i18nInstance)).toThrow(
      "receiver address"
    );
  });

  it("addPendingTransfer_throws_for_unsupported_type", () => {
    const store = useHistoryStore();
    expect(() => store.addPendingTransfer({ ...baseReceivePayload(), type: "unsupported" }, i18nInstance)).toThrow(
      "cannot be assembled"
    );
  });

  it("addPendingTransfer_tolerates_non_string_currency", () => {
    const store = useHistoryStore();
    store.addPendingTransfer({ ...baseReceivePayload(), currency: 42 }, i18nInstance);
    expect(store.getPendingTransfer("1")).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // addPendingTransfer — route step assembly
  // ---------------------------------------------------------------------------
  it("addPendingTransfer_builds_route_steps_for_transfer_operations", () => {
    seedConfigCurrencies();
    const store = useHistoryStore();
    store.addPendingTransfer(
      {
        ...baseReceivePayload(),
        skipRoute: {
          amount_out: "1000000",
          operations: [
            { amount_in: "100", amount_out: "99", transfer: { from_chain_id: "osmosis", to_chain_id: "axelar" } },
            { amount_in: "99", amount_out: "98", cctp_transfer: { from_chain_id: "axelar", to_chain_id: "noble" } }
          ]
        },
        chains: {
          osmosis: { icon: "osmosis.svg", label: "Osmosis" },
          axelar: { icon: "axelar.svg", label: "Axelar" },
          noble: { icon: "noble.svg", label: "Noble" }
        }
      },
      i18nInstance
    );

    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
    const { route, routeDetails } = entry.historyData;
    if (route === undefined || routeDetails === undefined) throw new Error("expected route steppers to be assembled");
    expect(route.steps).toHaveLength(3);
    expect(routeDetails.steps).toHaveLength(3);
    expect(routeDetails.steps[0]).toMatchObject({
      label: "message.send-stepper",
      icon: "osmosis.svg",
      token: { balance: "1", symbol: "USDC" }
    });
    expect(routeDetails.steps[1]).toMatchObject({ label: "message.swap-stepper", icon: "axelar.svg" });
    expect(routeDetails.steps[2]).toMatchObject({ label: "message.receive-stepper", icon: "noble.svg" });
  });

  it("addPendingTransfer_skips_steps_with_unknown_chain", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.addPendingTransfer(
        {
          ...baseReceivePayload(),
          skipRoute: {
            amount_out: "1000000",
            operations: [
              { amount_in: "100", amount_out: "99", transfer: { from_chain_id: "missing", to_chain_id: "gone" } }
            ]
          }
        },
        i18nInstance
      );
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
      expect(entry.historyData.route).toMatchObject({ steps: [] });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("addPendingTransfer_skips_malformed_route_operations", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.addPendingTransfer(
        { ...baseReceivePayload(), skipRoute: { amount_out: "1000000", operations: ["bogus"] } },
        i18nInstance
      );
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
      expect(entry.historyData.route).toMatchObject({ steps: [] });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("addPendingTransfer_skips_swap_operation_with_unresolvable_chains", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      // A `swap` op is a recognized op kind handled on the same path as
      // transfer/cctp_transfer. An empty swap body has no resolvable from/to
      // chains, so the step is skipped with a logged error rather than falling
      // through silently as an unknown op.
      store.addPendingTransfer(
        { ...baseReceivePayload(), skipRoute: { amount_out: "1000000", operations: [{ swap: {} }] } },
        i18nInstance
      );
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
      expect(entry.historyData.route).toMatchObject({ steps: [] });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("addPendingTransfer_skips_step_with_malformed_amount_in", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.addPendingTransfer(
        {
          ...baseReceivePayload(),
          skipRoute: {
            amount_out: "1000000",
            operations: [{ amount_out: "99", transfer: { from_chain_id: "osmosis", to_chain_id: "noble" } }]
          },
          chains: {
            osmosis: { icon: "osmosis.svg", label: "Osmosis" },
            noble: { icon: "noble.svg", label: "Noble" }
          }
        },
        i18nInstance
      );
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
      expect(entry.historyData.route).toMatchObject({ steps: [] });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("addPendingTransfer_skips_receive_step_with_malformed_amount_out", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.addPendingTransfer(
        {
          ...baseReceivePayload(),
          skipRoute: {
            amount_out: "1000000",
            operations: [{ amount_in: "100", transfer: { from_chain_id: "osmosis", to_chain_id: "noble" } }]
          },
          chains: {
            osmosis: { icon: "osmosis.svg", label: "Osmosis" },
            noble: { icon: "noble.svg", label: "Noble" }
          }
        },
        i18nInstance
      );
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
      const route = entry.historyData.route;
      if (route === undefined) throw new Error("expected route stepper to be assembled");
      // The send step (amount_in) is kept; only the malformed receive step is dropped.
      expect(route.steps).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // ---------------------------------------------------------------------------
  // Swap op-kind rendering. getRouteSteps recognizes a `swap` op alongside
  // `transfer` / `cctp_transfer`. Real Skip swap ops carry `chain_id` +
  // `from_chain_id` but no `to_chain_id` (see the captured osmosis-swap
  // baseline), so chain resolution falls back to `chain_id` and a single-chain
  // swap renders as an on-chain step.
  // ---------------------------------------------------------------------------
  it("addPendingTransfer_renders_a_step_for_a_swap_operation", () => {
    seedConfigCurrencies();
    const store = useHistoryStore();
    store.addPendingTransfer(
      {
        ...baseReceivePayload(),
        skipRoute: {
          amount_out: "8156769821",
          operations: [
            {
              amount_in: "10000000",
              amount_out: "8156769821",
              swap: { chain_id: "osmosis-1", from_chain_id: "osmosis-1" }
            }
          ]
        },
        chains: { "osmosis-1": { icon: "osmosis.svg", label: "Osmosis" } }
      },
      i18nInstance
    );

    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
    const routeDetails = entry.historyData.routeDetails;
    if (routeDetails === undefined) throw new Error("expected route stepper to be assembled");
    expect(routeDetails.steps.length).toBeGreaterThan(0);
  });

  it("addPendingTransfer_swap_leg_adds_a_step_to_a_transfer_swap_transfer_route", () => {
    seedConfigCurrencies();
    const store = useHistoryStore();

    const chains = {
      nolus: { icon: "nolus.svg", label: "Nolus" },
      solana: { icon: "solana.svg", label: "Solana" }
    };
    const transferLeg = (from: string, to: string) => ({
      amount_in: "100",
      amount_out: "99",
      transfer: { from_chain_id: from, to_chain_id: to }
    });
    // Real Skip swap-op shape: `chain_id` + `from_chain_id`, no `to_chain_id`.
    const swapLeg = { amount_in: "99", amount_out: "200", swap: { chain_id: "solana", from_chain_id: "solana" } };

    store.addPendingTransfer(
      {
        ...baseReceivePayload(),
        id: 10,
        skipRoute: {
          amount_out: "1000000",
          operations: [transferLeg("nolus", "solana"), transferLeg("solana", "nolus")]
        },
        chains
      },
      i18nInstance
    );
    store.addPendingTransfer(
      {
        ...baseReceivePayload(),
        id: 11,
        skipRoute: {
          amount_out: "1000000",
          operations: [transferLeg("nolus", "solana"), swapLeg, transferLeg("solana", "nolus")]
        },
        chains
      },
      i18nInstance
    );

    const withoutSwap = store.pendingTransfers["10"]?.historyData.routeDetails;
    const withSwap = store.pendingTransfers["11"]?.historyData.routeDetails;
    if (withoutSwap === undefined || withSwap === undefined) throw new Error("expected both route steppers");
    expect(withSwap.steps.length).toBeGreaterThan(withoutSwap.steps.length);
  });

  it("addPendingTransfer_renders_swap_leg_from_captured_osmosis_payload", () => {
    seedConfigCurrencies();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      // Operations lifted verbatim from the captured production quote
      // (.claude/baselines/osmosis-swap-baseline): an on-chain swap leg
      // (`chain_id`+`from_chain_id`, no `to_chain_id`) then an IBC transfer home.
      store.addPendingTransfer(
        {
          ...baseReceivePayload(),
          skipRoute: {
            amount_out: "8156769821",
            operations: [
              {
                amount_in: "10000000",
                amount_out: "8156769821",
                swap: { chain_id: "osmosis-1", from_chain_id: "osmosis-1" }
              },
              {
                amount_in: "8156769821",
                amount_out: "8156769821",
                transfer: { chain_id: "osmosis-1", from_chain_id: "osmosis-1", to_chain_id: "pirin-1" }
              }
            ]
          },
          chains: {
            "osmosis-1": { icon: "osmosis.svg", label: "Osmosis" },
            "pirin-1": { icon: "nolus.svg", label: "Nolus" }
          }
        },
        i18nInstance
      );

      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to be created");
      const routeDetails = entry.historyData.routeDetails;
      if (routeDetails === undefined) throw new Error("expected route stepper to be assembled");
      // Swap leg + transfer leg + receive step = 3; the swap leg is rendered,
      // not dropped, and nothing is skipped with an error.
      expect(routeDetails.steps).toHaveLength(3);
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // ---------------------------------------------------------------------------
  // Status / step transitions on pending transfers
  // ---------------------------------------------------------------------------
  it("updatePendingTransferStatus_updates_status", () => {
    const store = useHistoryStore();
    store.addPendingTransfer(baseReceivePayload(), i18nInstance);

    store.updatePendingTransferStatus("1", CONFIRM_STEP.SUCCESS);
    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
    expect(entry.historyData.status).toBe(CONFIRM_STEP.SUCCESS);
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
    const planted = plantedEntry("1");
    planted.historyData.route = { steps: [], activeStep: 0 };
    planted.historyData.routeDetails = { steps: [], activeStep: 0 };
    store.pendingTransfers["1"] = planted;

    store.incrementPendingTransferStep("1");
    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
    const { route, routeDetails } = entry.historyData;
    if (route === undefined || routeDetails === undefined) throw new Error("expected planted route steppers");
    expect(route.activeStep).toBe(1);
    expect(routeDetails.activeStep).toBe(1);
  });

  it("incrementPendingTransferStep_logs_and_noops_without_route", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.pendingTransfers["1"] = plantedEntry("1");

      store.incrementPendingTransferStep("1");
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
      expect(entry.historyData.route).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("completePendingTransfer_sets_success", () => {
    const store = useHistoryStore();
    const planted = plantedEntry("1");
    planted.historyData.route = {
      steps: [
        { label: "a", icon: "a" },
        { label: "b", icon: "b" }
      ],
      activeStep: 0
    };
    planted.historyData.routeDetails = {
      steps: [
        { label: "a", icon: "a" },
        { label: "b", icon: "b" }
      ],
      activeStep: 0
    };
    store.pendingTransfers["1"] = planted;

    store.completePendingTransfer("1");
    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
    expect(entry.historyData.status).toBe(CONFIRM_STEP.SUCCESS);
    const route = entry.historyData.route;
    if (route === undefined) throw new Error("expected planted route stepper");
    expect(route.activeStep).toBe(2);
  });

  it("completePendingTransfer_marks_success_without_route", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.pendingTransfers["1"] = plantedEntry("1");

      store.completePendingTransfer("1");
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
      expect(entry.historyData.status).toBe(CONFIRM_STEP.SUCCESS);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("failPendingTransfer_sets_error_and_marks_step_failed", () => {
    const store = useHistoryStore();
    const planted = plantedEntry("1");
    planted.historyData.route = {
      steps: [
        { label: "a", icon: "a" },
        { label: "b", icon: "b" }
      ],
      activeStep: 0
    };
    planted.historyData.routeDetails = {
      steps: [
        { label: "a", icon: "a" },
        { label: "b", icon: "b" }
      ],
      activeStep: 0
    };
    store.pendingTransfers["1"] = planted;

    store.failPendingTransfer("1", "nope");
    const entry = store.pendingTransfers["1"];
    if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
    const h = entry.historyData;
    expect(h.status).toBe(CONFIRM_STEP.ERROR);
    expect(h.errorMsg).toBe("nope");
    const { route, routeDetails } = h;
    if (route === undefined || routeDetails === undefined) throw new Error("expected planted route steppers");
    const routeStep = route.steps[0];
    if (routeStep === undefined) throw new Error("expected a first route step");
    expect(routeStep).toMatchObject({ status: "failed" });
    const detailsStep = routeDetails.steps[0];
    if (detailsStep === undefined) throw new Error("expected a first routeDetails step");
    expect(detailsStep).toMatchObject({ status: "failed" });
  });

  it("failPendingTransfer_marks_error_without_route", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.pendingTransfers["1"] = plantedEntry("1");

      store.failPendingTransfer("1", "boom");
      const entry = store.pendingTransfers["1"];
      if (entry === undefined) throw new Error("expected pending transfer 1 to exist");
      expect(entry.historyData.status).toBe(CONFIRM_STEP.ERROR);
      expect(entry.historyData.errorMsg).toBe("boom");
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("setTransferTxHashes_and_removePendingTransfer_and_clearPendingTransfers", () => {
    const store = useHistoryStore();
    store.pendingTransfers["1"] = plantedEntry("1");
    store.pendingTransfers["2"] = plantedEntry("2");

    store.setTransferTxHashes("1", ["0xabc"]);
    const updated = store.pendingTransfers["1"];
    if (updated === undefined) throw new Error("expected pending transfer 1 to exist");
    expect(updated.historyData.txHashes).toEqual(["0xabc"]);

    store.removePendingTransfer("1");
    expect(store.pendingTransfers["1"]).toBeUndefined();
    expect(store.pendingTransfers["2"]).toBeDefined();

    store.clearPendingTransfers();
    expect(store.pendingTransfers).toEqual({});
  });

  it("setTransferTxHashes_noop_when_id_missing", () => {
    const store = useHistoryStore();
    // Must not throw.
    store.setTransferTxHashes("does-not-exist", ["0x1"]);
    expect(store.pendingTransfers["does-not-exist"]).toBeUndefined();
  });

  it("pendingTransfersList_sorted_by_id_desc", () => {
    const store = useHistoryStore();
    store.pendingTransfers["1"] = plantedEntry("1");
    store.pendingTransfers["3"] = plantedEntry("3");
    store.pendingTransfers["2"] = plantedEntry("2");

    const ids = store.pendingTransfersList.map((t) => t.historyData.id);
    expect(ids).toEqual(["3", "2", "1"]);
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

  it("fetchTransactions_defaults_timestamp_when_human_date_unavailable", async () => {
    vi.mocked(getCreatedAtForHuman).mockReturnValueOnce(null);
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const store = useHistoryStore();
    store.address = "nolus1abc";
    const res = await store.fetchTransactions(0, 50);
    const entry = res[0];
    if (entry === undefined) throw new Error("expected one fetched transaction");
    expect(entry.historyData.timestamp).toBe("");
  });

  it("fetchTransactions_skips_entries_with_unrecognized_message_shape", async () => {
    vi.mocked(message).mockResolvedValueOnce([null]);
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.address = "nolus1abc";
      const res = await store.fetchTransactions(0, 50);
      expect(res).toEqual([]);
      expect(store.transactions).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchTransactions_wraps_i18n_for_message_formatters", async () => {
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const store = useHistoryStore();
    store.address = "nolus1abc";
    await store.fetchTransactions(0, 50);

    const lastCall = vi.mocked(message).mock.lastCall;
    if (lastCall === undefined) throw new Error("expected message() to have been called");
    const t = lastCall[2].t;
    if (typeof t !== "function") throw new Error("expected the i18n adapter to expose t()");
    expect(t("message.yes")).toBe("message.yes");
    expect(t("message.send-action", { amount: "1" })).toBe("message.send-action");
    expect(() => t(42)).toThrow("translation key");
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

  it("loadActivities_skips_entries_with_unrecognized_message_shape", async () => {
    vi.mocked(message).mockResolvedValueOnce([null]);
    api.getTransactions.mockResolvedValueOnce([{ id: "a", timestamp: "2024-01-01T00:00:00Z" }]);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useHistoryStore();
      store.address = "nolus1abc";
      await store.loadActivities();
      expect(store.activities.loaded).toBe(true);
      expect(store.activities.data).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
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

  it("initialize_skips_reload_for_same_address", async () => {
    api.getTransactions.mockResolvedValue([]);
    const store = useHistoryStore();
    await store.initialize("nolus1abc");
    await store.initialize("nolus1abc");
    expect(api.getTransactions).toHaveBeenCalledTimes(1);
  });

  it("setAddress_null_triggers_cleanup", async () => {
    api.getTransactions.mockResolvedValue([]);
    const store = useHistoryStore();
    await store.initialize("nolus1abc");
    store.pendingTransfers["1"] = plantedEntry("1");

    store.setAddress(null);
    expect(store.address).toBeNull();
    expect(store.initialized).toBe(false);
    expect(store.pendingTransfers).toEqual({});
    expect(store.activities.data).toEqual([]);
  });
});
