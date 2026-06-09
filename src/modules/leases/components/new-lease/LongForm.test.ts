import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as VueRouter from "vue-router";
import type * as NolusJs from "@nolus/nolusjs";
import { setActivePinia, createPinia } from "pinia";

vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
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
  const leaseQuote = vi.fn();
  const getDownpaymentRange = vi.fn();
  const getCachedProtocolCurrencies = vi.fn();
  const getActiveProtocolsForNetwork = vi.fn();
  const routerPush = vi.fn();
  const loggerError = vi.fn();

  const LONG_PROTOCOL = "OSMOSIS-OSMOSIS-ALL_BTC";

  const longProtocols = [{ protocol: LONG_PROTOCOL, network: "Osmosis", position_type: "Long" }];

  // WETH listed first so it is the default selected collateral (index 0).
  const protocolCurrencies = [
    { ticker: "WETH", decimals: 18, shortName: "ETH", group: "lease" as const },
    { ticker: "ALL_BTC", decimals: 8, shortName: "BTC", group: "lease" as const }
  ];

  const currenciesData = {
    "WETH@OSMOSIS-OSMOSIS-ALL_BTC": {
      key: "WETH@OSMOSIS-OSMOSIS-ALL_BTC",
      ticker: "WETH",
      name: "Ethereum",
      shortName: "ETH",
      symbol: "ibc/WETH",
      icon: "",
      decimal_digits: 18,
      ibcData: "ibc/WETH",
      native: false
    },
    "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC": {
      key: "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC",
      ticker: "ALL_BTC",
      name: "Alloyed BTC",
      shortName: "BTC",
      symbol: "ibc/ALLBTC",
      icon: "",
      decimal_digits: 8,
      ibcData: "ibc/ALLBTC",
      native: false
    }
  };

  const prices = {
    "WETH@OSMOSIS-OSMOSIS-ALL_BTC": { price: "2000" },
    "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC": { price: "77000" }
  };

  // Mutable per-test: default to no balance (the zero-balance repro).
  const state: { balances: { denom: string; amount: string }[] } = { balances: [] };

  return {
    leaseQuote,
    getDownpaymentRange,
    getCachedProtocolCurrencies,
    getActiveProtocolsForNetwork,
    routerPush,
    loggerError,
    LONG_PROTOCOL,
    longProtocols,
    protocolCurrencies,
    currenciesData,
    prices,
    state
  };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof VueRouter>("vue-router");
  return {
    ...actual,
    useRouter: () => ({ push: hoisted.routerPush }),
    useRoute: () => ({ params: {}, meta: {} })
  };
});

vi.mock("@/router", () => ({
  RouteNames: { LEASES: "leases" }
}));

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({ wallet: null })
}));

vi.mock("@/common/stores/balances", () => ({
  useBalancesStore: () => ({
    get balances() {
      return hoisted.state.balances;
    },
    fetchBalances: vi.fn()
  })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    initialized: true,
    protocolFilter: "OSMOSIS",
    get longProtocolsForCurrentNetwork() {
      return hoisted.longProtocols;
    },
    getCachedProtocolCurrencies: hoisted.getCachedProtocolCurrencies,
    getActiveProtocolsForNetwork: hoisted.getActiveProtocolsForNetwork,
    hasShortProtocols: () => false,
    isNetworkDisabled: () => false,
    get currenciesData() {
      return hoisted.currenciesData;
    },
    contracts: {
      [hoisted.LONG_PROTOCOL]: { leaser: "nolus1leaser" }
    }
  })
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.prices;
    }
  })
}));

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: vi.fn() })
}));

vi.mock("@/common/utils", async () => {
  const Int = (await import("@keplr-wallet/unit")).Int;
  return {
    getMicroAmount: (_denom: string, amount: string) => ({
      mAmount: {
        amount: new Int(Math.trunc(Number(amount || "0") * 1e8))
      },
      coinMinimalDenom: "ibc/WETH"
    }),
    Logger: { error: hoisted.loggerError },
    walletOperation: vi.fn(),
    classifyError: (e: unknown) =>
      e instanceof Error && /liquidity/i.test(e.message) ? "message.no-liquidity" : "message.unexpected-error"
  };
});

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatDecAsUsd: () => "$0",
  formatUsd: () => "$0",
  formatTokenBalance: () => "0"
}));

vi.mock("@/common/utils/LeaseConfigService", () => ({
  getDownpaymentRange: hoisted.getDownpaymentRange
}));

// Child component of LongForm — its internal logic is irrelevant for these tests.
vi.mock("@/modules/leases/components/new-lease/LongLeaseDetails.vue", () => ({
  default: { name: "LongLeaseDetails", template: "<div />" }
}));

vi.mock("@nolus/nolusjs", async () => {
  const actual = await vi.importActual<typeof NolusJs>("@nolus/nolusjs");
  return {
    ...actual,
    NolusClient: {
      getInstance: () => ({ getCosmWasmClient: async () => ({}) })
    }
  };
});

vi.mock("@nolus/nolusjs/build/contracts", () => ({
  Leaser: class {
    leaseQuote = hoisted.leaseQuote;
  }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("web-components", () => ({
  AdvancedFormControl: {
    name: "AdvancedFormControl",
    props: [
      "id",
      "currencyOptions",
      "label",
      "balanceLabel",
      "placeholder",
      "calculatedBalance",
      "disabledCurrencyPicker",
      "disabledInputField",
      "errorMsg",
      "inputClass",
      "itemsHeadline",
      "itemTemplate",
      "selectedCurrencyOption"
    ],
    emits: ["input", "onSelectedCurrency"],
    template: `
      <div>
        <div data-test="err">{{ errorMsg }}</div>
        <input data-test="amount" @input="$emit('input', $event.target.value)" />
      </div>
    `
  },
  Button: {
    name: "Button",
    props: ["label", "disabled", "loading", "size", "severity"],
    template: '<button data-test="submit" :disabled="disabled || loading">{{ label }}</button>'
  },
  Dropdown: {
    name: "Dropdown",
    props: ["id", "onSelect", "options", "size", "selected", "searchable", "disabled"],
    template: '<div data-test="dropdown" />'
  },
  Radio: {
    name: "Radio",
    props: ["id", "label", "checked", "name", "disabled"],
    template: '<input type="radio" />'
  },
  Slider: {
    name: "Slider",
    props: ["disabled", "minPosition", "maxPosition", "positions"],
    emits: ["onDrag"],
    template: '<div data-test="slider" />'
  },
  Size: { medium: "medium" },
  AssetItem: { name: "AssetItem", template: "<div />" },
  ToastType: { success: "success", error: "error" }
}));

import { mount, flushPromises } from "@vue/test-utils";
import LongForm from "./LongForm.vue";

function factory() {
  return mount(LongForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: {
        onShowToast: vi.fn(),
        reload: vi.fn()
      }
    }
  });
}

describe("LongForm.vue — reactive balance validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.state.balances = [];

    hoisted.getDownpaymentRange.mockResolvedValue({
      WETH: { min: "1", max: "1000000000" },
      ALL_BTC: { min: "1", max: "1000000000" }
    });
    hoisted.getCachedProtocolCurrencies.mockReturnValue(hoisted.protocolCurrencies);
    hoisted.getActiveProtocolsForNetwork.mockReturnValue([hoisted.LONG_PROTOCOL]);

    hoisted.leaseQuote.mockResolvedValue({
      borrow: { ticker: "WETH", amount: "100000" },
      total: { ticker: "WETH", amount: "500000000" },
      annual_interest_rate: 100,
      annual_interest_rate_margin: 80
    });
  });

  it("shows insufficient-balance (not 'Unexpected error') when collateral balance is zero", async () => {
    // No wallet balance for the selected collateral — the exact repro from the
    // bug report. The quote must NOT be attempted; the message must be specific.
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.5");
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-test="err"]').text()).toBe("message.invalid-balance-big");
    expect(wrapper.find('[data-test="err"]').text()).not.toBe("message.unexpected-error");
    expect(hoisted.leaseQuote).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("flags a zero amount as invalid before attempting a quote", async () => {
    hoisted.state.balances = [{ denom: "ibc/WETH", amount: "1000000000000000000" }];

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0");
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-test="err"]').text()).toBe("message.invalid-balance-low");
    expect(hoisted.leaseQuote).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("attempts the quote when the amount is within the wallet balance", async () => {
    // 1 WETH balance; 0.5 WETH down payment is within it and within range.
    hoisted.state.balances = [{ denom: "ibc/WETH", amount: "1000000000000000000" }];

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.5");
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-test="err"]').text()).toBe("");
    expect(hoisted.leaseQuote).toHaveBeenCalled();
    wrapper.unmount();
  });
});

describe("LongForm.vue — quote error classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    // 1 WETH balance and a permissive range so the reactive validation passes
    // and calculate() reaches the quote — the path under test here.
    hoisted.state.balances = [{ denom: "ibc/WETH", amount: "1000000000000000000" }];

    hoisted.getDownpaymentRange.mockResolvedValue({
      WETH: { min: "1", max: "1000000000" },
      ALL_BTC: { min: "1", max: "1000000000" }
    });
    hoisted.getCachedProtocolCurrencies.mockReturnValue(hoisted.protocolCurrencies);
    hoisted.getActiveProtocolsForNetwork.mockReturnValue([hoisted.LONG_PROTOCOL]);
  });

  it("maps contract 'No liquidity' errors to the no-liquidity i18n key", async () => {
    hoisted.leaseQuote.mockRejectedValueOnce(new Error("query wasm: No liquidity for the requested loan"));

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.5");
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-test="err"]').text()).toBe("message.no-liquidity");
    wrapper.unmount();
  });

  it("maps non-liquidity errors to unexpected-error (stops masking the true cause)", async () => {
    hoisted.leaseQuote.mockRejectedValueOnce(new Error("invalid downpayment ticker"));

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.5");
    await flushPromises();
    await wrapper.vm.$nextTick();
    await flushPromises();

    expect(wrapper.find('[data-test="err"]').text()).toBe("message.unexpected-error");
    wrapper.unmount();
  });
});
