import { describe, it, expect, vi, beforeEach } from "vitest";
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
  const getProtocolCurrencies = vi.fn();
  const getCachedProtocolCurrencies = vi.fn();
  const routerPush = vi.fn();
  const loggerError = vi.fn();

  const SHORT_PROTOCOL = "OSMOSIS-OSMOSIS-ALL_BTC";

  const shortProtocols = [
    {
      protocol: SHORT_PROTOCOL,
      network: "Osmosis",
      position_type: "Short",
      lpn: "ALL_BTC",
      lpn_display: { ticker: "ALL_BTC", shortName: "BTC", icon: "" }
    }
  ];

  // Shape matches ProtocolCurrencyInfo from the backend — for a Short protocol
  // group="lease" IS the stable (USDC_NOBLE), group="lpn" is the borrowed asset.
  const protocolCurrencies = [
    {
      ticker: "ALL_BTC",
      decimals: 8,
      shortName: "BTC",
      displayName: "Alloyed BTC",
      icon: "",
      bank_symbol: "ibc/ALLBTC",
      dex_symbol: "dex-allbtc",
      group: "lpn" as const,
      price: "77000"
    },
    {
      ticker: "USDC_NOBLE",
      decimals: 6,
      shortName: "USDC",
      displayName: "Noble USDC",
      icon: "",
      bank_symbol: "ibc/USDCNOBLE",
      dex_symbol: "dex-usdc",
      group: "lease" as const,
      price: "1"
    }
  ];

  const currenciesData = {
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
    },
    "USDC_NOBLE@OSMOSIS-OSMOSIS-ALL_BTC": {
      key: "USDC_NOBLE@OSMOSIS-OSMOSIS-ALL_BTC",
      ticker: "USDC_NOBLE",
      name: "Noble USDC",
      shortName: "USDC",
      symbol: "ibc/USDCNOBLE",
      icon: "",
      decimal_digits: 6,
      ibcData: "ibc/USDCNOBLE",
      native: false
    }
  };

  // BTC balance ~0.005 BTC (~$385) so it sorts first as the default collateral.
  const balances = [
    { denom: "ibc/ALLBTC", amount: "500000" },
    { denom: "ibc/USDCNOBLE", amount: "1000000" }
  ];

  const prices = {
    "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC": { price: "77000" },
    "USDC_NOBLE@OSMOSIS-OSMOSIS-ALL_BTC": { price: "1" }
  };

  return {
    leaseQuote,
    getDownpaymentRange,
    getProtocolCurrencies,
    getCachedProtocolCurrencies,
    routerPush,
    loggerError,
    SHORT_PROTOCOL,
    shortProtocols,
    protocolCurrencies,
    currenciesData,
    balances,
    prices
  };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof import("vue-router")>("vue-router");
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
      return hoisted.balances;
    },
    fetchBalances: vi.fn()
  })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    initialized: true,
    get shortProtocolsForCurrentNetwork() {
      return hoisted.shortProtocols;
    },
    getCachedProtocolCurrencies: hoisted.getCachedProtocolCurrencies,
    getProtocolCurrencies: hoisted.getProtocolCurrencies,
    get currenciesData() {
      return hoisted.currenciesData;
    },
    contracts: {
      [hoisted.SHORT_PROTOCOL]: { leaser: "nolus1leaser" }
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
      coinMinimalDenom: "ibc/ALLBTC"
    }),
    Logger: { error: hoisted.loggerError },
    walletOperation: vi.fn()
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

// Child component of ShortForm — its internal logic is irrelevant for these tests.
vi.mock("@/modules/leases/components/new-lease/ShortLeaseDetails.vue", () => ({
  default: { name: "ShortLeaseDetails", template: "<div />" }
}));

vi.mock("@nolus/nolusjs", async () => {
  const actual = await vi.importActual<typeof import("@nolus/nolusjs")>("@nolus/nolusjs");
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
        <button
          data-test="pick-usdc"
          @click="$emit('onSelectedCurrency', currencyOptions.find(c => c.ticker === 'USDC_NOBLE'))"
        />
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
    props: ["id", "label", "checked", "name"],
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

import { mount } from "@vue/test-utils";
import ShortForm from "./ShortForm.vue";

function flushMicrotasks() {
  return new Promise((r) => setTimeout(r, 0));
}

function factory() {
  return mount(ShortForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: {
        onShowToast: vi.fn(),
        reload: vi.fn()
      }
    }
  });
}

describe("ShortForm.vue — leaseQuote ticker resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());

    // Default: range is permissive so validateMinMaxValues passes and calculate() runs.
    hoisted.getDownpaymentRange.mockResolvedValue({ ALL_BTC: { min: "1", max: "1000000000" } });

    hoisted.getCachedProtocolCurrencies.mockReturnValue(hoisted.protocolCurrencies);
    hoisted.getProtocolCurrencies.mockResolvedValue(hoisted.protocolCurrencies);

    hoisted.leaseQuote.mockResolvedValue({
      borrow: { ticker: "ALL_BTC", amount: "100000" },
      total: { ticker: "USDC_NOBLE", amount: "400000000" },
      annual_interest_rate: 100,
      annual_interest_rate_margin: 80
    });
  });

  it("passes the protocol stable (USDC_NOBLE) as leaseTicker when collateral is non-stable (ALL_BTC)", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-test="amount"]').setValue("0.001");
    await flushMicrotasks();
    await wrapper.vm.$nextTick();
    await flushMicrotasks();

    expect(hoisted.leaseQuote).toHaveBeenCalled();
    const args = hoisted.leaseQuote.mock.calls[0];
    // args: [microAmount, downPaymentTicker, leaseTicker, ltd]
    expect(args[1]).toBe("ALL_BTC");
    expect(args[2]).toBe("USDC_NOBLE");
    wrapper.unmount();
  });

  it("still passes USDC_NOBLE as leaseTicker when collateral is the stable itself", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();

    // Switch selected collateral to USDC_NOBLE via the stubbed picker.
    await wrapper.find('[data-test="pick-usdc"]').trigger("click");
    await wrapper.find('[data-test="amount"]').setValue("100");
    await flushMicrotasks();
    await wrapper.vm.$nextTick();
    await flushMicrotasks();

    expect(hoisted.leaseQuote).toHaveBeenCalled();
    const args = hoisted.leaseQuote.mock.calls[0];
    expect(args[1]).toBe("USDC_NOBLE");
    expect(args[2]).toBe("USDC_NOBLE");
    wrapper.unmount();
  });

  it("surfaces unexpected-error (not no-liquidity) when the protocol has no stable (config drift)", async () => {
    // Simulate a Short protocol missing a group="lease" currency entirely.
    hoisted.getProtocolCurrencies.mockResolvedValue([
      {
        ticker: "ALL_BTC",
        decimals: 8,
        group: "lpn",
        shortName: "BTC",
        displayName: "BTC",
        icon: "",
        bank_symbol: "",
        dex_symbol: ""
      }
    ]);

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.001");
    await flushMicrotasks();
    await wrapper.vm.$nextTick();
    await flushMicrotasks();

    expect(hoisted.leaseQuote).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="err"]').text()).toBe("message.unexpected-error");
    wrapper.unmount();
  });

  it("maps contract 'No liquidity' errors to the no-liquidity i18n key", async () => {
    hoisted.leaseQuote.mockRejectedValueOnce(new Error("query wasm: No liquidity for the requested loan"));

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.001");
    await flushMicrotasks();
    await wrapper.vm.$nextTick();
    await flushMicrotasks();

    expect(wrapper.find('[data-test="err"]').text()).toBe("message.no-liquidity");
    wrapper.unmount();
  });

  it("maps non-liquidity errors to unexpected-error (stops masking the true cause)", async () => {
    hoisted.leaseQuote.mockRejectedValueOnce(new Error("invalid downpayment ticker"));

    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.001");
    await flushMicrotasks();
    await wrapper.vm.$nextTick();
    await flushMicrotasks();

    expect(wrapper.find('[data-test="err"]').text()).toBe("message.unexpected-error");
    wrapper.unmount();
  });
});
