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
  const broadcastTx = vi.fn();
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const markLeaseInProgress = vi.fn();
  const getLease = vi.fn();
  const getLeaseDisplayData = vi.fn();
  const getLeasePositionSpec = vi.fn();
  const skipGetRoute = vi.fn();
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
    lpn: [{ key: "USDC@osmosis-1", shortName: "USDC" }],
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
    getLeasePositionSpec,
    skipGetRoute,
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
    get currenciesData() {
      return hoisted.configRef.currenciesData;
    },
    get lpn() {
      return hoisted.configRef.lpn;
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

vi.mock("@/common/utils", async () => {
  const Int = (await import("@keplr-wallet/unit")).Int;
  return {
    getMicroAmount: (_denom: string, amount: string) => ({
      mAmount: {
        amount: new Int(Math.trunc(Number(amount || "0") * 1e6))
      },
      coinMinimalDenom: "ibc/ATOM"
    }),
    Logger: { error: hoisted.loggerError },
    walletOperation: hoisted.walletOperationMock
  };
});

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => v,
  formatDecAsUsd: () => "$0",
  formatUsd: () => "$0",
  formatPriceUsd: () => "$0",
  formatTokenBalance: () => "0",
  formatPercent: () => "0%"
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getLpnByProtocol: () => ({
    key: "USDC@osmosis-1",
    shortName: "USDC",
    ibcData: "ibc/USDC",
    decimal_digits: 6
  }),
  getCurrencyByTicker: () => ({ key: "USDC@osmosis-1", decimal_digits: 6, shortName: "USDC" })
}));

vi.mock("@/common/utils/LeaseConfigService", () => ({
  getLeasePositionSpec: hoisted.getLeasePositionSpec
}));

vi.mock("@/common/utils/SkipRoute", () => ({
  SkipRouter: {
    getRoute: hoisted.skipGetRoute
  }
}));

// Use real CurrencyUtils (Dec math) so computed properties don't crash.
// Only mock NolusClient for the contract call path.
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
  Lease: class {
    async simulateClosePositionLeaseTx() {
      return { txHash: "0x1", txBytes: new Uint8Array([1]), usedFee: {} };
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
    props: ["minPosition", "maxPosition", "midPosition", "value", "labelLeft", "labelMid", "labelRight"],
    emits: ["onDrag", "clickRightLabel", "clickLeftLabel", "clickMidLabel"],
    template: `
      <div>
        <button data-test="slider-right" @click="$emit('clickRightLabel')"></button>
        <button data-test="slider-left" @click="$emit('clickLeftLabel')"></button>
        <button data-test="slider-mid" @click="$emit('clickMidLabel')"></button>
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
  Tooltip: { name: "Tooltip", props: ["content", "position"], template: "<span><slot /></span>" },
  SvgIcon: { name: "SvgIcon", props: ["name"], template: "<i />" },
  ToastType: { success: "success", error: "error" }
}));

import { mount } from "@vue/test-utils";
import { Dec } from "@keplr-wallet/unit";
import CloseDialog from "./CloseDialog.vue";

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    address: "nolus1lease",
    status: "opened",
    protocol: "osmosis-1",
    amount: { ticker: "ATOM", amount: "1000000000" },
    debt: {
      ticker: "USDC",
      principal: "500000000",
      amount: "500000000",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "0",
      due_interest: "0"
    },
    etl_data: undefined,
    ...overrides
  };
}

function factory() {
  return mount(CloseDialog, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: {
        onShowToast: vi.fn(),
        reload: vi.fn()
      }
    }
  });
}

describe("CloseDialog.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = { broadcastTx: hoisted.broadcastTx, address: "nolus1abc" };
    hoisted.broadcastTx.mockResolvedValue({});
    hoisted.walletOperationMock.mockImplementation(async (op: () => Promise<void> | void) => {
      await op();
    });
    hoisted.getLease.mockReturnValue(makeLease());
    hoisted.getLeaseDisplayData.mockReturnValue({
      openingPrice: new Dec("1"),
      totalDebt: new Dec("0")
    });
    hoisted.getLeasePositionSpec.mockResolvedValue({ min_asset: { ticker: "USDC", amount: "1000000" } });
    hoisted.skipGetRoute.mockResolvedValue({
      usd_amount_in: "100",
      usd_amount_out: "100",
      swap_price_impact_percent: "0"
    });
  });

  it("renders without throwing when a cached open lease is present", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('[data-test="title"]').text()).toBe("message.close");
    wrapper.unmount();
  });

  it("renders submit button with close-btn-label", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="submit"]').text()).toBe("message.close-btn-label");
    wrapper.unmount();
  });

  it("redirects to leases index when cached lease is closed", async () => {
    hoisted.getLease.mockReturnValue(makeLease({ status: "closed" }));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(hoisted.routerPush).toHaveBeenCalledWith("/leases");
    wrapper.unmount();
  });

  it("loads lease position spec via getLeasePositionSpec", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.getLeasePositionSpec).toHaveBeenCalledWith("osmosis-1");
    wrapper.unmount();
  });

  it("handles missing cached lease gracefully", async () => {
    hoisted.getLease.mockReturnValue(undefined);
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    // no crash, no redirect
    expect(hoisted.routerPush).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("clicking submit calls walletOperation (closing flow)", async () => {
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

  it("does not crash when lease ticker is missing from currenciesData (unknown-asset guard)", async () => {
    // Simulate version skew: chain returns a ticker not present in local config.
    hoisted.getLease.mockReturnValue(makeLease({ amount: { ticker: "UNKNOWN", amount: "1000000000" } }));
    const toast = vi.fn();
    const wrapper = mount(CloseDialog, {
      global: {
        mocks: { $t: (k: string) => k },
        provide: {
          onShowToast: toast,
          reload: vi.fn()
        }
      }
    });
    await wrapper.vm.$nextTick();
    // Component must not throw during render; a toast with the unknown-asset i18n key fires.
    expect(wrapper.exists()).toBe(true);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "message.close-unknown-asset" })
    );
    wrapper.unmount();
  });

  it("does not crash when currency.value is null during transient states (lpn fallback)", async () => {
    // Drive the `lpn` computed with no matching asset: an unknown ticker makes
    // `assets` empty, so `currency.value` is undefined. The `lpn` computed must
    // not throw accessing `.key.split(...)`.
    hoisted.getLease.mockReturnValue(makeLease({ amount: { ticker: "MISSING", amount: "1000000000" } }));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    // Force lpn evaluation by flipping slider to 100 (renders `lpn` in template).
    await wrapper.find('[data-test="slider-right"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it("does not crash and surfaces a toast when market price is zero (invalid-price guard)", async () => {
    // Oracle hiccup: openingPrice is zero, so repaymentInStable.quo(price) would throw.
    hoisted.getLeaseDisplayData.mockReturnValue({
      openingPrice: new Dec("0"),
      totalDebt: new Dec("0")
    });
    const toast = vi.fn();
    const wrapper = mount(CloseDialog, {
      global: {
        mocks: { $t: (k: string) => k },
        provide: {
          onShowToast: toast,
          reload: vi.fn()
        }
      }
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.exists()).toBe(true);
    // Attempt to submit — action must bail out with error toast, walletOperation must not proceed.
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "message.close-invalid-price" })
    );
    expect(hoisted.broadcastTx).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
