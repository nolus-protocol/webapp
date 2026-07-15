/**
 * Guard-branch coverage for TakeProfitDialog added with the strict tsconfig
 * floor (#178): the selected-currency binding (conditional spread keeps
 * `undefined` out of the optional AdvancedFormControl prop) and the payout
 * fallback when the lease asset cannot be resolved from currenciesData.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as VueRouter from "vue-router";
import type * as NolusJs from "@nolus/nolusjs";
import { setActivePinia, createPinia } from "pinia";

const hoisted = vi.hoisted(() => {
  const broadcastTx = vi.fn();
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const getLease = vi.fn();
  const getLeaseDisplayData = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const loggerError = vi.fn();
  const routerPush = vi.fn();

  const routeRef = { params: { id: "lease-1" } };

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
      }
    },
    positionType: "Long" as "Long" | "Short"
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
    getLease,
    getLeaseDisplayData,
    walletOperationMock,
    loggerError,
    routerPush,
    routeRef,
    walletRef,
    configRef,
    pricesRef
  };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof VueRouter>("vue-router");
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
  useBalancesStore: () => ({ fetchBalances: hoisted.fetchBalances })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    get currenciesData() {
      return hoisted.configRef.currenciesData;
    },
    getPositionType: (_p: string) => hoisted.configRef.positionType
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
    getLeaseDisplayData: hoisted.getLeaseDisplayData
  })
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: hoisted.loggerError },
  walletOperation: hoisted.walletOperationMock,
  classifyError: () => "message.unexpected-error"
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => v,
  formatPriceUsd: (v: string | number) => `$${v}`
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
  Lease: class {
    async simulateChangeClosePolicyTx() {
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
    props: ["id", "currencyOptions", "placeholder", "errorMsg", "selectedCurrencyOption", "valueOnly", "balanceLabel"],
    emits: ["input"],
    template: `
      <div>
        <div data-test="err">{{ errorMsg }}</div>
        <input data-test="amount" @input="$emit('input', $event.target.value)" />
        <slot name="label" />
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

import { mount, flushPromises } from "@vue/test-utils";
import { Dec } from "@keplr-wallet/unit";
import TakeProfitDialog from "./TakeProfitDialog.vue";

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
    close_policy: {},
    etl_data: undefined,
    ...overrides
  };
}

function factory(provide: Record<string, unknown> = {}) {
  return mount(TakeProfitDialog, {
    global: {
      mocks: {
        $t: (k: string, params?: Record<string, unknown>) => (params ? `${k} ${JSON.stringify(params)}` : k)
      },
      provide: {
        onShowToast: vi.fn(),
        reload: vi.fn(),
        ...provide
      }
    }
  });
}

describe("TakeProfitDialog.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = { broadcastTx: hoisted.broadcastTx, address: "nolus1abc" };
    hoisted.configRef.positionType = "Long";
    hoisted.getLease.mockReturnValue(makeLease());
    hoisted.getLeaseDisplayData.mockReturnValue({
      openingPrice: new Dec("1"),
      totalDebt: new Dec("0"),
      stableAsset: new Dec("1"),
      unitAsset: new Dec("1")
    });
  });

  it("passes the resolved lease asset as the selected currency option", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    const control = wrapper.findComponent({ name: "AdvancedFormControl" });
    expect(control.props("selectedCurrencyOption")).toMatchObject({ ticker: "ATOM" });
    wrapper.unmount();
  });

  it("omits the selected currency option entirely when the lease asset is unknown", async () => {
    hoisted.getLease.mockReturnValue(makeLease({ amount: { ticker: "UNKNOWN", amount: "1000000000" } }));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    const control = wrapper.findComponent({ name: "AdvancedFormControl" });
    expect(control.props("selectedCurrencyOption")).toBeUndefined();
    wrapper.unmount();
  });

  it("falls back to a zero payout instead of throwing when the lease asset is unknown", async () => {
    hoisted.getLease.mockReturnValue(makeLease({ amount: { ticker: "UNKNOWN", amount: "1000000000" } }));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("5");
    await wrapper.vm.$nextTick();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain('message.stoppings-payout {"amount":"0"}');
    wrapper.unmount();
  });

  it("renders a non-zero payout for a known Long lease asset", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("5");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("message.stoppings-payout");
    expect(wrapper.text()).not.toContain('message.stoppings-payout {"amount":"0"}');
    wrapper.unmount();
  });

  // take-profit success must surface the take-profit toast, not the
  // stop-loss toast both original SFCs unconditionally emitted.
  it("emits the take-profit success toast on a completed submit", async () => {
    const onShowToast = vi.fn();
    const wrapper = factory({ onShowToast });
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("5");
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="submit"]').trigger("click");
    await flushPromises();
    expect(hoisted.loggerError).not.toHaveBeenCalled();
    expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ message: "message.take-profit-toast" }));
    wrapper.unmount();
  });

  // getPercent take-profit branch must guard the zero divisor the
  // stop-loss branch already guards; without the guard quo() throws, the
  // submit is swallowed by operation()'s catch, and no toast is emitted.
  it("completes the submit without throwing when the unit asset is zero (Long)", async () => {
    hoisted.getLeaseDisplayData.mockReturnValue({
      openingPrice: new Dec("1"),
      totalDebt: new Dec("0"),
      stableAsset: new Dec("1"),
      unitAsset: new Dec("0")
    });
    const onShowToast = vi.fn();
    const wrapper = factory({ onShowToast });
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("5");
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="submit"]').trigger("click");
    await flushPromises();
    expect(hoisted.loggerError).not.toHaveBeenCalled();
    expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ message: "message.take-profit-toast" }));
    wrapper.unmount();
  });

  it("completes the submit without throwing when the unit asset is zero (Short)", async () => {
    hoisted.configRef.positionType = "Short";
    hoisted.getLeaseDisplayData.mockReturnValue({
      openingPrice: new Dec("1"),
      totalDebt: new Dec("0"),
      stableAsset: new Dec("1"),
      unitAsset: new Dec("0")
    });
    const onShowToast = vi.fn();
    const wrapper = factory({ onShowToast });
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="amount"]').setValue("0.5");
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="submit"]').trigger("click");
    await flushPromises();
    expect(hoisted.loggerError).not.toHaveBeenCalled();
    expect(onShowToast).toHaveBeenCalledWith(expect.objectContaining({ message: "message.take-profit-toast" }));
    wrapper.unmount();
  });
});
