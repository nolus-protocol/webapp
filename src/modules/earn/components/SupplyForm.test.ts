import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  const getBalance = vi.fn((_ibc: string) => "0");
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const validateAmountV2Mock = vi.fn((_a: string, _b: string) => "");
  const getProtocolApr = vi.fn((_p: string) => 0);
  const routerPush = vi.fn();

  const walletRef: { value: { address: string; broadcastTx: ReturnType<typeof vi.fn> } | null } = {
    value: { address: "nolus1abc", broadcastTx: vi.fn() }
  };

  const pricesState: Record<string, { price: string }> = {
    "USDC@OSMOSIS": { price: "1" }
  };

  // Default config: one lpn in OSMOSIS protocol
  const configRef = {
    initialized: true,
    protocolFilter: "OSMOSIS",
    lpn: [{ key: "USDC@OSMOSIS" }] as Array<{ key: string }> | undefined,
    currenciesData: {
      "USDC@OSMOSIS": {
        key: "USDC@OSMOSIS",
        name: "USD Coin",
        shortName: "USDC",
        ticker: "USDC",
        ibcData: "ibc/USDC",
        icon: "",
        decimal_digits: 6
      }
    } as Record<string, unknown>,
    contracts: {
      OSMOSIS: { lpp: "nolus1lppcontract" }
    } as Record<string, { lpp: string }>,
    getActiveProtocolsForNetwork: vi.fn((_f: string) => ["OSMOSIS"])
  };

  return {
    getBalance,
    fetchBalances,
    loadActivities,
    walletOperationMock,
    validateAmountV2Mock,
    getProtocolApr,
    routerPush,
    walletRef,
    pricesState,
    configRef
  };
});

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({
    get wallet() {
      return hoisted.walletRef.value;
    }
  })
}));

vi.mock("@/common/stores/balances", () => ({
  useBalancesStore: () => ({
    getBalance: hoisted.getBalance,
    fetchBalances: hoisted.fetchBalances
  })
}));

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: hoisted.loadActivities })
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.pricesState;
    }
  })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    get initialized() {
      return hoisted.configRef.initialized;
    },
    get protocolFilter() {
      return hoisted.configRef.protocolFilter;
    },
    get lpn() {
      return hoisted.configRef.lpn;
    },
    get currenciesData() {
      return hoisted.configRef.currenciesData;
    },
    get contracts() {
      return hoisted.configRef.contracts;
    },
    getActiveProtocolsForNetwork: hoisted.configRef.getActiveProtocolsForNetwork
  })
}));

vi.mock("@/common/stores/earn", () => ({
  useEarnStore: () => ({
    getProtocolApr: hoisted.getProtocolApr
  })
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: vi.fn() },
  getMicroAmount: (_denom: string, amount: string) => ({
    mAmount: { amount: { toString: () => (Number(amount) * 1e6).toString() } },
    coinMinimalDenom: "ibc/USDC"
  }),
  validateAmountV2: hoisted.validateAmountV2Mock,
  walletOperation: hoisted.walletOperationMock
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`,
  formatTokenBalance: (v: unknown) => (v as { toString: () => string }).toString()
}));

vi.mock("@/config/global", () => ({
  SORT_PROTOCOLS: ["OSMOSIS", "NEUTRON"],
  PERCENT: 100
}));

vi.mock("../../../config/global/network", () => ({
  NATIVE_NETWORK: { earnEstimation: 10 }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

// Mock EarnChart so we don't pull in observable/d3
vi.mock("./EarnChart.vue", () => ({
  default: {
    name: "EarnChart",
    props: ["currencyKey", "amount"],
    template: '<div data-test="earn-chart">{{ currencyKey }}</div>'
  }
}));

vi.mock("./Info.vue", () => ({
  default: { name: "Info", template: "<i />" }
}));

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertDenomToMinimalDenom: (amt: string) => ({
      amount: { gt: () => false, toString: () => String(amt) }
    }),
    convertMinimalDenomToDenom: (_amt: string) => ({ toString: () => "0" })
  },
  NolusClient: {
    getInstance: () => ({
      getCosmWasmClient: vi.fn().mockResolvedValue({})
    })
  }
}));

vi.mock("@nolus/nolusjs/build/contracts", () => ({
  Lpp: class {
    async getDepositCapacity() {
      return { amount: "1000000" };
    }
    async simulateDepositTx() {
      return { txBytes: new Uint8Array([1]) };
    }
  }
}));

vi.mock("web-components", () => ({
  AdvancedFormControl: {
    name: "AdvancedFormControl",
    props: [
      "id",
      "currencyOptions",
      "label",
      "balanceLabel",
      "selectedCurrencyOption",
      "placeholder",
      "calculatedBalance",
      "errorMsg",
      "inputClass",
      "searchable",
      "itemsHeadline",
      "itemTemplate"
    ],
    emits: ["input", "on-selected-currency"],
    template: `
      <div>
        <div data-test="balance">{{ currencyOptions[0]?.balance?.customLabel }}</div>
        <div data-test="calc">{{ calculatedBalance }}</div>
        <div data-test="error">{{ errorMsg }}</div>
        <input data-test="amount" @input="$emit('input', $event.target.value)" />
        <slot name="label" />
      </div>
    `
  },
  Button: {
    name: "Button",
    props: ["size", "severity", "label", "loading", "disabled"],
    emits: ["click"],
    template:
      '<button data-test="submit" :disabled="loading || disabled" @click="$emit(\'click\')">{{ label }}</button>'
  },
  SvgIcon: { name: "SvgIcon", props: ["name"], template: "<i />" },
  AssetItem: { name: "AssetItem", template: "<i />" },
  ToastType: { success: "success", error: "error" }
}));

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import SupplyForm from "./SupplyForm.vue";

function factory(onShowToast: ReturnType<typeof vi.fn> = vi.fn()) {
  return mount(SupplyForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: { onShowToast, close: vi.fn(), loadLPNCurrency: vi.fn() }
    }
  });
}

describe("SupplyForm.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.configRef.initialized = true;
    hoisted.configRef.protocolFilter = "OSMOSIS";
    hoisted.configRef.lpn = [{ key: "USDC@OSMOSIS" }];
    hoisted.configRef.getActiveProtocolsForNetwork = vi.fn((_f: string) => ["OSMOSIS"]);
    hoisted.getBalance.mockReturnValue("0");
    hoisted.getProtocolApr.mockReturnValue(5);
    hoisted.validateAmountV2Mock.mockReturnValue("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing with at least one asset", () => {
    const wrapper = factory();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  describe("empty assets guard (config fetch error)", () => {
    beforeEach(() => {
      // Force the `assets` computed to hit its catch → returns []
      hoisted.configRef.getActiveProtocolsForNetwork = vi.fn(() => {
        throw new Error("config unavailable");
      });
    });

    it("apr computed returns 0 (no TypeError) when assets is empty — bug #1", () => {
      const wrapper = factory();
      // Reading `apr` on the vm triggers the computed; without the guard
      // this throws `Cannot read properties of undefined (reading 'key')`.
      const vm = wrapper.vm as unknown as { apr: number; assets: unknown[] };
      expect(vm.assets).toEqual([]);
      expect(() => vm.apr).not.toThrow();
      expect(vm.apr).toBe(0);
      wrapper.unmount();
    });

    it("amountStr computed does not throw when assets is empty — bug #2", () => {
      const wrapper = factory();
      const vm = wrapper.vm as unknown as { amountStr: string; assets: unknown[] };
      expect(vm.assets).toEqual([]);
      expect(() => vm.amountStr).not.toThrow();
      wrapper.unmount();
    });

    it("EarnChart is not rendered when assets is empty even with positive amount — bug #2", async () => {
      const wrapper = factory();
      // Directly set the component's input to a positive value — bypasses onInput/
      // validateInputs (which have their own separate crash surface, out of scope).
      (wrapper.vm as unknown as { input: string }).input = "100";
      await nextTick();
      // EarnChart uses `:currencyKey="assets[selectedCurrency].key"`. Without
      // a template guard, rendering this branch with empty assets would throw.
      expect(wrapper.find('[data-test="earn-chart"]').exists()).toBe(false);
      wrapper.unmount();
    });
  });
});
