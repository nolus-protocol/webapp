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
  const broadcastTx = vi.fn();
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const markLeaseInProgress = vi.fn();
  const getLease = vi.fn();
  const getLeaseDisplayData = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const loggerError = vi.fn();
  const routerPush = vi.fn();
  const routeRef = {
    params: { id: "lease-1" },
    matched: [{ path: "/" }, { path: "/leases" }, { path: "/leases" }]
  };

  const walletRef: { value: { broadcastTx: typeof broadcastTx; address: string } | null } = {
    value: { broadcastTx, address: "nolus1abc" }
  };

  const configRef = {
    initialized: false,
    currenciesData: {
      "ATOM@osmosis-1": {
        key: "ATOM@osmosis-1",
        name: "Cosmos",
        symbol: "ATOM",
        shortName: "ATOM",
        ticker: "ATOM",
        icon: "",
        decimal_digits: 6,
        ibcData: "ibc/ATOM",
        native: false
      },
      "USDC@osmosis-1": {
        key: "USDC@osmosis-1",
        name: "USD Coin",
        symbol: "USDC",
        shortName: "USDC",
        ticker: "USDC",
        icon: "",
        decimal_digits: 6,
        ibcData: "ibc/USDC",
        native: false
      }
    },
    getPositionType: (_p: string) => "Long"
  };

  const balancesRef = {
    balances: [{ denom: "ibc/USDC", amount: "10000000" }]
  };
  const pricesRef = {
    prices: {
      "USDC@osmosis-1": { price: "1" },
      "ATOM@osmosis-1": { price: "10" }
    }
  };

  return {
    broadcastTx,
    fetchBalances,
    loadActivities,
    markLeaseInProgress,
    getLease,
    getLeaseDisplayData,
    walletOperationMock,
    loggerError,
    routerPush,
    routeRef,
    walletRef,
    configRef,
    balancesRef,
    pricesRef
  };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof import("vue-router")>("vue-router");
  return {
    ...actual,
    useRoute: () => hoisted.routeRef,
    useRouter: () => ({ push: hoisted.routerPush })
  };
});

vi.mock("@/router", () => ({
  RouteNames: { LEASES: "leases" }
}));

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({
    get wallet() {
      return hoisted.walletRef.value;
    }
  })
}));

vi.mock("@/common/stores/balances", () => ({
  useBalancesStore: () => ({
    get balances() {
      return hoisted.balancesRef.balances;
    },
    fetchBalances: hoisted.fetchBalances
  })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    get initialized() {
      return hoisted.configRef.initialized;
    },
    get currenciesData() {
      return hoisted.configRef.currenciesData;
    },
    getPositionType: hoisted.configRef.getPositionType
  })
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.pricesRef.prices;
    }
  })
}));

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: hoisted.loadActivities })
}));

vi.mock("@/common/stores/leases", () => ({
  useLeasesStore: () => ({
    getLease: hoisted.getLease,
    getLeaseDisplayData: hoisted.getLeaseDisplayData,
    markLeaseInProgress: hoisted.markLeaseInProgress
  })
}));

vi.mock("@/common/utils", () => ({
  getMicroAmount: (_denom: string, amount: string) => ({
    mAmount: { amount: { toString: () => (Number(amount) * 1e6).toString() } },
    coinMinimalDenom: "ibc/USDC"
  }),
  Logger: { error: hoisted.loggerError },
  LeaseUtils: {
    calculateLiquidation: () => ({ toString: () => "0" }),
    calculateLiquidationShort: () => ({ toString: () => "0" })
  },
  walletOperation: hoisted.walletOperationMock
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => v,
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`,
  formatUsd: (_v: number) => "$0",
  formatTokenBalance: (v: unknown) => (v as { toString: () => string }).toString()
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getLpnByProtocol: () => ({
    key: "USDC@osmosis-1",
    shortName: "USDC",
    ibcData: "ibc/USDC",
    decimal_digits: 6
  })
}));

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertDenomToMinimalDenom: (amt: string) => ({
      amount: {
        toString: () => (Number(amt || "0") * 1e6).toString(),
        toDec: () => ({
          isZero: () => false,
          lte: () => false,
          gt: () => false,
          lt: () => false,
          toString: () => String(amt)
        })
      }
    }),
    convertMinimalDenomToDenom: (amt: string) => ({
      toDec: () => ({
        mul: () => ({ toString: () => amt, mul: () => ({ toString: () => amt }) }),
        toString: () => amt
      })
    })
  },
  NolusClient: {
    getInstance: () => ({
      getCosmWasmClient: async () => ({})
    })
  },
  NolusWallet: class {}
}));

vi.mock("@nolus/nolusjs/build/contracts", () => ({
  Lease: class {
    async simulateRepayLeaseTx() {
      return { txBytes: new Uint8Array([1]) };
    }
  }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("web-components", () => ({
  Dialog: {
    name: "Dialog",
    props: ["title", "showClose", "disableClose"],
    emits: ["close-dialog"],
    template: `<div data-test="dialog"><div data-test="title">{{ title }}</div><slot name="content" /></div>`,
    methods: { show() {}, close() {} }
  },
  AdvancedFormControl: {
    name: "AdvancedFormControl",
    props: [
      "id",
      "currencyOptions",
      "placeholder",
      "calculatedBalance",
      "errorMsg",
      "selectedCurrencyOption",
      "valueOnly"
    ],
    emits: ["input"],
    template: `
      <div>
        <div data-test="err">{{ errorMsg }}</div>
        <input data-test="amount" @input="$emit('input', $event.target.value)" />
        <slot name="label" />
      </div>
    `
  },
  Slider: {
    name: "Slider",
    props: ["minPosition", "maxPosition", "value", "labelLeft", "labelRight"],
    emits: ["onDrag", "clickRightLabel", "clickLeftLabel"],
    template: `
      <div>
        <button data-test="slider-right" @click="$emit('clickRightLabel')"></button>
        <button data-test="slider-left" @click="$emit('clickLeftLabel')"></button>
      </div>
    `
  },
  Button: {
    name: "Button",
    props: ["label", "disabled", "loading", "size", "severity"],
    emits: ["click"],
    template:
      '<button data-test="submit" :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}</button>'
  },
  SvgIcon: { name: "SvgIcon", props: ["name"], template: "<i />" },
  Tooltip: { name: "Tooltip", props: ["content", "position"], template: "<span><slot /></span>" },
  ToastType: { success: "success", error: "error" }
}));

import { mount } from "@vue/test-utils";
import RepayDialog from "./RepayDialog.vue";

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    address: "nolus1lease",
    status: "opened",
    protocol: "osmosis-1",
    amount: { ticker: "ATOM", amount: "1000000000" },
    debt: { ticker: "USDC", principal: "500000000", amount: "500000000" },
    etl_data: undefined,
    ...overrides
  };
}

function factory() {
  return mount(RepayDialog, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: {
        onShowToast: vi.fn(),
        reload: vi.fn()
      }
    }
  });
}

describe("RepayDialog.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = { broadcastTx: hoisted.broadcastTx, address: "nolus1abc" };
    hoisted.configRef.initialized = true;
    hoisted.broadcastTx.mockResolvedValue({});
    hoisted.walletOperationMock.mockImplementation(async (op: () => Promise<void> | void) => {
      await op();
    });
    hoisted.getLease.mockReturnValue(makeLease());
    hoisted.getLeaseDisplayData.mockReturnValue({ openingPrice: { toString: () => "1" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing when lease is loaded", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('[data-test="title"]').text()).toBe("message.repay");
    wrapper.unmount();
  });

  it("renders submit button labeled 'repay'", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="submit"]').text()).toBe("message.repay");
    wrapper.unmount();
  });

  it("redirects to leases index when cached lease is closed", async () => {
    hoisted.getLease.mockReturnValue(makeLease({ status: "closed" }));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(hoisted.routerPush).toHaveBeenCalledWith("/leases");
    wrapper.unmount();
  });

  it("does not render content body when config is not initialized", async () => {
    hoisted.configRef.initialized = false;
    hoisted.getLease.mockClear();
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(hoisted.getLease).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("clicking the submit button triggers walletOperation path", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.walletOperationMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("logs error when walletOperation rejects", async () => {
    hoisted.walletOperationMock.mockRejectedValueOnce(new Error("boom"));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.loggerError).toHaveBeenCalled();
    wrapper.unmount();
  });
});
