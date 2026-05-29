import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { Dec } from "@keplr-wallet/unit";

// jsdom doesn't provide matchMedia; some store-adjacent modules read it at init.
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

// Mock @/common/api so the config and prices stores import cleanly without a
// real HTTP/WebSocket client. We drive the config store via fetchConfig /
// fetchCurrencies and set prices directly on the prices store.
vi.mock("@/common/api", () => ({
  BackendApi: {
    getConfig: vi.fn(),
    getCurrencies: vi.fn(),
    getNetworkAssets: vi.fn(),
    getGatedProtocols: vi.fn(),
    getGasFeeConfig: vi.fn(),
    getProtocolCurrencies: vi.fn(),
    getPrices: vi.fn()
  },
  WebSocketClient: {
    subscribePrices: vi.fn(() => () => {})
  }
}));

import { BackendApi } from "@/common/api";
import { useConfigStore } from "../stores/config";
import { usePricesStore } from "../stores/prices";
import { getPriceForCurrency } from "./CurrencyLookup";

const api = BackendApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

// USDC lives on two protocols sharing one IBC denom. OSMOSIS is the network's
// primary protocol and the only one with a published price; NEUTRON's key is
// unpriced. The denom-keyed map can resolve to either entry.
const USDC_OSMOSIS = {
  key: "USDC@OSMOSIS",
  ticker: "USDC",
  protocol: "OSMOSIS",
  symbol: "USDC",
  shortName: "USDC",
  ibcData: "ibc/USDC_SHARED",
  decimal_digits: 6,
  group: "lpn",
  native: false
};
const USDC_NEUTRON = {
  key: "USDC@NEUTRON",
  ticker: "USDC",
  protocol: "NEUTRON",
  symbol: "USDC",
  shortName: "USDC",
  ibcData: "ibc/USDC_SHARED",
  decimal_digits: 6,
  group: "lpn",
  native: false
};
const WBTC_OSMOSIS = {
  key: "WBTC@OSMOSIS",
  ticker: "WBTC",
  protocol: "OSMOSIS",
  symbol: "WBTC",
  shortName: "WBTC",
  ibcData: "ibc/WBTC_OSMO",
  decimal_digits: 8,
  group: "lease",
  native: false
};

function configFixture() {
  return {
    protocols: {
      OSMOSIS: {
        is_active: true,
        network: "Osmosis",
        position_type: "long",
        contracts: { oracle: "o", lpp: "l", leaser: "le", profit: "p" }
      },
      NEUTRON: {
        is_active: true,
        network: "Neutron",
        position_type: "short",
        contracts: { oracle: "o", lpp: "l", leaser: "le", profit: "p" }
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
      }
    ],
    native_asset: { ticker: "NLS", denom: "unls", decimals: 6 }
  };
}

function currenciesFixture() {
  return {
    currencies: {
      "USDC@OSMOSIS": USDC_OSMOSIS,
      "USDC@NEUTRON": USDC_NEUTRON,
      "WBTC@OSMOSIS": WBTC_OSMOSIS
    },
    lpn: [USDC_OSMOSIS],
    lease_currencies: ["WBTC"],
    map: {}
  };
}

async function primedStores() {
  api.getConfig.mockResolvedValueOnce(configFixture());
  api.getCurrencies.mockResolvedValueOnce(currenciesFixture());

  const configStore = useConfigStore();
  await configStore.fetchConfig();
  await configStore.fetchCurrencies();
  configStore.setProtocolFilter("OSMOSIS");

  const pricesStore = usePricesStore();
  // Only the primary-protocol key is priced; the NEUTRON key is absent.
  pricesStore.prices = { "USDC@OSMOSIS": { price: "1.0001", symbol: "USDC" } };

  return { configStore, pricesStore };
}

describe("getPriceForCurrency", () => {
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

  it("returns the currency's own price when its key is published", async () => {
    await primedStores();
    expect(getPriceForCurrency(USDC_OSMOSIS as any)).toBe("1.0001");
  });

  it("falls back to the network's primary-protocol key when the denom-resolved key is unpriced", async () => {
    await primedStores();
    // USDC resolved via the shared IBC denom landed on the NEUTRON entry, which
    // has no published price. The Assets table resolves USDC via the primary
    // OSMOSIS protocol, so the dropdown must land on the same price.
    expect(getPriceForCurrency(USDC_NEUTRON as any)).toBe("1.0001");
  });

  it('returns "0" when neither the currency key nor the primary key is priced', async () => {
    const { pricesStore } = await primedStores();
    pricesStore.prices = {};
    expect(getPriceForCurrency(USDC_NEUTRON as any)).toBe("0");
  });

  it("keeps a held USDC balance above zero-balance assets in the dropdown sort", async () => {
    await primedStores();

    // Mirror the dropdown's per-asset value + comparator. USDC is resolved via
    // its unpriced NEUTRON key; WBTC holds no balance.
    const usdcValue = new Dec("4764612", 6); // 4.764612 USDC
    const usdcStable = new Dec(getPriceForCurrency(USDC_NEUTRON as any)).mul(usdcValue);
    const wbtcStable = new Dec(getPriceForCurrency(WBTC_OSMOSIS as any)).mul(new Dec("0", 8));

    expect(usdcStable.isZero()).toBe(false);

    const sorted = [
      { ticker: "WBTC", stable: wbtcStable },
      { ticker: "USDC", stable: usdcStable }
    ].sort((a, b) => Number(b.stable.sub(a.stable).toString(8)));

    expect(sorted[0].ticker).toBe("USDC");
  });
});
