import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Mock the @/common/api module so BackendApi is a namespace of vi.fn() stubs.
// We do NOT exercise the real HTTP client here; we want to test the store's
// state transitions and getter logic only.
vi.mock("@/common/api", () => ({
  BackendApi: {
    getConfig: vi.fn(),
    getCurrencies: vi.fn(),
    getAssets: vi.fn(),
    getNetworkAssets: vi.fn(),
    getGatedProtocols: vi.fn(),
    getGasFeeConfig: vi.fn(),
    getProtocolCurrencies: vi.fn()
  }
}));

import { BackendApi } from "@/common/api";
import { useConfigStore } from "./index";

// Minimal typed-any accessor to the mocked BackendApi members.
// Using `as any` is acceptable in test code to access vi.fn() helpers.
 
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

// ---------------------------------------------------------------------------
// Minimal fixtures — just enough to drive the getters we test.
// ---------------------------------------------------------------------------
function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    protocols: {
      OSMOSIS: {
        is_active: true,
        network: "Osmosis",
        position_type: "long",
        contracts: {
          oracle: "nolus1oracle_osmo",
          lpp: "nolus1lpp_osmo",
          leaser: "nolus1leaser_osmo",
          profit: "nolus1profit_osmo"
        }
      },
      NEUTRON: {
        is_active: true,
        network: "Neutron",
        position_type: "short",
        contracts: {
          oracle: "nolus1oracle_ntrn",
          lpp: "nolus1lpp_ntrn",
          leaser: "nolus1leaser_ntrn",
          profit: "nolus1profit_ntrn"
        }
      }
    },
    networks: [
      {
        key: "OSMOSIS",
        chain_id: "osmosis-1",
        name: "Osmosis",
        prefix: "osmo",
        value: "osmosis",
        primary_protocol: "OSMOSIS",
        icon: "/icons/osmosis.svg",
        native: false
      },
      {
        key: "NOLUS",
        chain_id: "pirin-1",
        name: "Nolus",
        prefix: "nolus",
        value: "nolus",
        icon: "/icons/nolus.svg",
        native: true
      }
    ],
    native_asset: {
      ticker: "NLS",
      denom: "unls",
      decimals: 6
    },
    ...overrides
  };
}

function makeCurrencies(overrides: Record<string, unknown> = {}) {
  return {
    currencies: {
      "USDC@OSMOSIS": {
        key: "USDC@OSMOSIS",
        ticker: "USDC",
        protocol: "OSMOSIS",
        symbol: "USDC",
        shortName: "USDC",
        ibcData: "ibc/USDC_OSMO",
        decimal_digits: 6,
        group: "lease",
        native: false
      },
      "USDC@NEUTRON": {
        key: "USDC@NEUTRON",
        ticker: "USDC",
        protocol: "NEUTRON",
        symbol: "USDC",
        shortName: "USDC",
        ibcData: "ibc/USDC_NTRN",
        decimal_digits: 6,
        group: "lease",
        native: false
      },
      "NLS@NOLUS": {
        key: "NLS@NOLUS",
        ticker: "NLS",
        protocol: "NOLUS",
        symbol: "NLS",
        shortName: "NLS",
        ibcData: "unls",
        decimal_digits: 6,
        group: "native",
        native: true
      }
    },
    lpn: [
      {
        key: "USDC@OSMOSIS",
        ticker: "USDC",
        protocol: "OSMOSIS",
        symbol: "USDC",
        shortName: "USDC",
        ibcData: "ibc/USDC_OSMO",
        decimal_digits: 6,
        group: "lpn",
        native: false
      }
    ],
    lease_currencies: ["USDC"],
    map: {},
    ...overrides
  };
}

describe("ConfigStore", () => {
  // -------------------------------------------------------------------------
  // Initial state & localStorage persistence
  // -------------------------------------------------------------------------
  it("initial_state_defaults", () => {
    const store = useConfigStore();
    expect(store.config).toBeNull();
    expect(store.currenciesResponse).toBeNull();
    expect(store.initialized).toBe(false);
    expect(store.protocolFilter).toBe("");
    expect(store.selectedNetwork).toBe("mainnet");
  });

  it("protocolFilter_persisted_to_localStorage_on_set", async () => {
    const store = useConfigStore();
    store.setProtocolFilter("OSMOSIS");
    // watchers are flushed on the next microtask
    await Promise.resolve();
    expect(localStorage.getItem("protocol_filter")).toBe("OSMOSIS");
  });

  it("protocolFilter_cleared_from_localStorage_on_empty", async () => {
    localStorage.setItem("protocol_filter", "OSMOSIS");
    const store = useConfigStore();
    store.clearProtocolFilter();
    await Promise.resolve();
    expect(localStorage.getItem("protocol_filter")).toBeNull();
  });

  it("selectedNetwork_persisted_to_localStorage_on_set", async () => {
    const store = useConfigStore();
    store.setSelectedNetwork("testnet");
    await Promise.resolve();
    expect(localStorage.getItem("selected_network")).toBe("testnet");
  });

  it("protocolFilter_read_from_localStorage_on_store_creation", () => {
    localStorage.setItem("protocol_filter", "NEUTRON");
    const store = useConfigStore();
    expect(store.protocolFilter).toBe("NEUTRON");
  });

  // -------------------------------------------------------------------------
  // Fetchers — success + error paths
  // -------------------------------------------------------------------------
  it("fetchConfig_populates_config_state", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    expect(store.config).not.toBeNull();
    expect(Object.keys(store.protocols)).toContain("OSMOSIS");
  });

  it("fetchConfig_throws_on_http_error", async () => {
    const err = new Error("boom");
    api.getConfig.mockRejectedValueOnce(err);
    const store = useConfigStore();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(store.fetchConfig()).rejects.toThrow("boom");
      expect(store.error).toBe("boom");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchCurrencies_populates_currenciesResponse_on_success", async () => {
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    const store = useConfigStore();
    await store.fetchCurrencies();
    expect(store.currenciesResponse).not.toBeNull();
    expect(store.hasCurrencies).toBe(true);
  });

  it("fetchCurrencies_throws_on_error", async () => {
    api.getCurrencies.mockRejectedValueOnce(new Error("bad"));
    const store = useConfigStore();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(store.fetchCurrencies()).rejects.toThrow("bad");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("fetchGatedProtocols_populates_gatedProtocolsResponse", async () => {
    api.getGatedProtocols.mockResolvedValueOnce({
      protocols: [{ protocol: "OSMOSIS", network: "Osmosis", position_type: "Long" }]
    });
    const store = useConfigStore();
    await store.fetchGatedProtocols();
    expect(store.gatedProtocols.length).toBe(1);
    expect(store.hasGatedProtocols).toBe(true);
  });

  it("fetchGasFeeConfig_populates_gasFeeConfig", async () => {
    api.getGasFeeConfig.mockResolvedValueOnce({
      gas_prices: { unls: "0.025" },
      gas_multiplier: 1.5
    });
    const store = useConfigStore();
    await store.fetchGasFeeConfig();
    expect(store.gasFeeConfig).toEqual({
      gas_prices: { unls: "0.025" },
      gas_multiplier: 1.5
    });
  });

  // -------------------------------------------------------------------------
  // initialize() lifecycle
  // -------------------------------------------------------------------------
  it("initialize_noop_when_already_initialized", async () => {
    api.getConfig.mockResolvedValue(makeConfig());
    api.getCurrencies.mockResolvedValue(makeCurrencies());
    api.getNetworkAssets.mockResolvedValue({ assets: [] });
    api.getGatedProtocols.mockResolvedValue({ protocols: [] });
    api.getGasFeeConfig.mockResolvedValue({ gas_prices: {}, gas_multiplier: 1 });
    api.getProtocolCurrencies.mockResolvedValue({ currencies: [] });

    const store = useConfigStore();
    await store.initialize();
    expect(store.initialized).toBe(true);

    const countAfterFirst = api.getConfig.mock.calls.length;
    await store.initialize();
    expect(api.getConfig.mock.calls.length).toBe(countAfterFirst);
  });

  it("initialize_calls_all_fetchers_and_sets_initialized_true", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    api.getNetworkAssets.mockResolvedValueOnce({ assets: [] });
    api.getGatedProtocols.mockResolvedValueOnce({ protocols: [] });
    api.getGasFeeConfig.mockResolvedValueOnce({ gas_prices: {}, gas_multiplier: 1 });

    const store = useConfigStore();
    await store.initialize();
    expect(store.initialized).toBe(true);
    expect(api.getConfig).toHaveBeenCalledTimes(1);
    expect(api.getCurrencies).toHaveBeenCalledTimes(1);
    expect(api.getNetworkAssets).toHaveBeenCalledTimes(1);
    expect(api.getGatedProtocols).toHaveBeenCalledTimes(1);
    expect(api.getGasFeeConfig).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Currency lookups — getCurrencyByTicker/Denom/Key etc.
  // -------------------------------------------------------------------------
  it("getCurrencyByTicker_prefers_active_protocol", async () => {
    api.getConfig.mockResolvedValueOnce({
      ...makeConfig(),
      protocols: {
        PROTO_A: {
          is_active: false,
          network: "X",
          position_type: "long",
          contracts: { oracle: "", lpp: "", leaser: "", profit: "" }
        },
        PROTO_B: {
          is_active: true,
          network: "X",
          position_type: "long",
          contracts: { oracle: "", lpp: "", leaser: "", profit: "" }
        }
      }
    });
    api.getCurrencies.mockResolvedValueOnce({
      currencies: {
        "FOO@PROTO_A": {
          key: "FOO@PROTO_A",
          ticker: "FOO",
          protocol: "PROTO_A",
          symbol: "FOO",
          shortName: "FOO",
          ibcData: "a",
          decimal_digits: 6,
          group: "lease"
        },
        "FOO@PROTO_B": {
          key: "FOO@PROTO_B",
          ticker: "FOO",
          protocol: "PROTO_B",
          symbol: "FOO",
          shortName: "FOO",
          ibcData: "b",
          decimal_digits: 6,
          group: "lease"
        }
      },
      lpn: [],
      lease_currencies: [],
      map: {}
    });

    const store = useConfigStore();
    await store.fetchConfig();
    await store.fetchCurrencies();
    const found = store.getCurrencyByTicker("FOO");
    expect(found?.protocol).toBe("PROTO_B");
  });

  it("getCurrencyByTicker_falls_back_to_first_when_none_active", async () => {
    api.getConfig.mockResolvedValueOnce({
      ...makeConfig(),
      protocols: {
        PROTO_A: {
          is_active: false,
          network: "X",
          position_type: "long",
          contracts: { oracle: "", lpp: "", leaser: "", profit: "" }
        }
      }
    });
    api.getCurrencies.mockResolvedValueOnce({
      currencies: {
        "FOO@PROTO_A": {
          key: "FOO@PROTO_A",
          ticker: "FOO",
          protocol: "PROTO_A",
          symbol: "FOO",
          shortName: "FOO",
          ibcData: "a",
          decimal_digits: 6,
          group: "lease"
        }
      },
      lpn: [],
      lease_currencies: [],
      map: {}
    });

    const store = useConfigStore();
    await store.fetchConfig();
    await store.fetchCurrencies();
    const found = store.getCurrencyByTicker("FOO");
    expect(found?.protocol).toBe("PROTO_A");
  });

  it("getCurrencyByDenom_returns_matching_currency", async () => {
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    const store = useConfigStore();
    await store.fetchCurrencies();
    const found = store.getCurrencyByDenom("ibc/USDC_OSMO");
    expect(found?.protocol).toBe("OSMOSIS");
  });

  it("getCurrencyByKey_returns_undefined_for_unknown_key", async () => {
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    const store = useConfigStore();
    await store.fetchCurrencies();
    expect(store.getCurrencyByKey("UNKNOWN@X")).toBeUndefined();
  });

  it("getNativeCurrency_returns_currency_where_native_true", async () => {
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    const store = useConfigStore();
    await store.fetchCurrencies();
    const native = store.getNativeCurrency();
    expect(native?.ticker).toBe("NLS");
  });

  it("getLpnByProtocol_finds_in_lpn_list", async () => {
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    const store = useConfigStore();
    await store.fetchCurrencies();
    const lpn = store.getLpnByProtocol("OSMOSIS");
    expect(lpn?.group).toBe("lpn");
  });

  it("getLpnByProtocol_returns_null_when_absent", async () => {
    api.getCurrencies.mockResolvedValueOnce(makeCurrencies());
    const store = useConfigStore();
    await store.fetchCurrencies();
    expect(store.getLpnByProtocol("NONEXISTENT")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Network filter logic
  // -------------------------------------------------------------------------
  it("isValidNetworkFilter_case_insensitive", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    expect(store.isValidNetworkFilter("osmosis")).toBe(true);
    expect(store.isValidNetworkFilter("OSMOSIS")).toBe(true);
    expect(store.isValidNetworkFilter("UNKNOWN")).toBe(false);
  });

  it("getAvailableNetworkFilters_returns_protocolsByNetwork_keys", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    const filters = store.getAvailableNetworkFilters();
    expect(filters).toContain("OSMOSIS");
    expect(filters).toContain("NEUTRON");
  });

  it("getNetworkFilterOptions_maps_keys_to_labels", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    const options = store.getNetworkFilterOptions();
    const osmosis = options.find((o) => o.value === "OSMOSIS");
    expect(osmosis?.label).toBe("Osmosis");
    expect(osmosis?.icon).toBe("/icons/osmosis.svg");
  });

  // -------------------------------------------------------------------------
  // Protocol lookups
  // -------------------------------------------------------------------------
  it("getProtocolByContract_matches_any_contract_address", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    expect(store.getProtocolByContract("nolus1oracle_osmo")).toBe("OSMOSIS");
    expect(store.getProtocolByContract("nolus1lpp_osmo")).toBe("OSMOSIS");
    expect(store.getProtocolByContract("nolus1leaser_osmo")).toBe("OSMOSIS");
    expect(store.getProtocolByContract("nolus1profit_osmo")).toBe("OSMOSIS");
  });

  it("getProtocolByContract_returns_undefined_for_unknown", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    expect(store.getProtocolByContract("nolus1unknown")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // getProtocolCurrencies caching + fallback
  // -------------------------------------------------------------------------
  it("getProtocolCurrencies_caches_response", async () => {
    api.getProtocolCurrencies.mockResolvedValue({
      currencies: [
        { group: "lease", ticker: "FOO", symbol: "FOO" },
        { group: "lpn", ticker: "USDC", symbol: "USDC" }
      ]
    });
    const store = useConfigStore();
    const a = await store.getProtocolCurrencies("OSMOSIS");
    const b = await store.getProtocolCurrencies("OSMOSIS");
    expect(a.length).toBe(2);
    expect(b.length).toBe(2);
    expect(api.getProtocolCurrencies).toHaveBeenCalledTimes(1);
  });

  it("getProtocolCurrencies_returns_empty_array_on_api_failure", async () => {
    api.getProtocolCurrencies.mockRejectedValueOnce(new Error("nope"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const store = useConfigStore();
      const result = await store.getProtocolCurrencies("MISSING");
      expect(result).toEqual([]);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  // -------------------------------------------------------------------------
  // Position type resolution
  // -------------------------------------------------------------------------
  it("getPositionType_prefers_gated_protocols", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    api.getGatedProtocols.mockResolvedValueOnce({
      protocols: [{ protocol: "OSMOSIS", network: "Osmosis", position_type: "Short" }]
    });
    const store = useConfigStore();
    await store.fetchConfig();
    await store.fetchGatedProtocols();
    // Config says OSMOSIS is long, gated says short — gated must win.
    expect(store.getPositionType("OSMOSIS")).toBe("Short");
  });

  it("getPositionType_falls_back_to_config_protocols", async () => {
    api.getConfig.mockResolvedValueOnce(makeConfig());
    const store = useConfigStore();
    await store.fetchConfig();
    expect(store.getPositionType("OSMOSIS")).toBe("Long");
    expect(store.getPositionType("NEUTRON")).toBe("Short");
  });

  it("getPositionType_defaults_to_Long_when_unknown", () => {
    const store = useConfigStore();
    expect(store.getPositionType("DOES_NOT_EXIST")).toBe("Long");
  });
});
