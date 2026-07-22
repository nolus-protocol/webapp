import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dec } from "@keplr-wallet/unit";

const hoisted = vi.hoisted(() => ({
  loading: false,
  leasesArr: [] as unknown[],
  failedOpensArr: [] as { address: string; reason: string }[],
  dismissFailedOpenMock: vi.fn(),
  pricesState: {} as Record<string, { price: string }>,
  walletState: { wallet: null as unknown },
  protocolFilter: "OSMOSIS",
  activeProtocols: [] as string[],
  protocols: {} as Record<string, { network?: string }>,
  currenciesData: {} as Record<string, { shortName?: string }>,
  assetIcons: {} as Record<string, string>,
  positionType: "Long",
  protocolDisabled: false,
  isMobile: false,
  isTablet: false,
  displayDataFn: vi.fn(),
  refreshMock: vi.fn(),
  fetchBalancesMock: vi.fn(),
  setHideMock: vi.fn(),
  getHideMock: vi.fn(() => false),
  intercomMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  routerPushMock: vi.fn()
}));

vi.mock("@/common/stores/leases", () => ({
  useLeasesStore: () => ({
    get loading() {
      return hoisted.loading;
    },
    get leases() {
      return hoisted.leasesArr;
    },
    get failedOpens() {
      return hoisted.failedOpensArr;
    },
    dismissFailedOpen: hoisted.dismissFailedOpenMock,
    refresh: hoisted.refreshMock,
    getLeaseDisplayData: hoisted.displayDataFn
  })
}));

vi.mock("@/common/stores/balances", () => ({
  useBalancesStore: () => ({ fetchBalances: hoisted.fetchBalancesMock })
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.pricesState;
    }
  })
}));

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => hoisted.walletState
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    getActiveProtocolsForNetwork: () => hoisted.activeProtocols,
    get protocolFilter() {
      return hoisted.protocolFilter;
    },
    get protocols() {
      return hoisted.protocols;
    },
    get currenciesData() {
      return hoisted.currenciesData;
    },
    get assetIcons() {
      return hoisted.assetIcons;
    },
    getPositionType: () => hoisted.positionType,
    isProtocolFilterDisabled: () => hoisted.protocolDisabled
  })
}));

vi.mock("@/common/utils", () => ({
  isMobile: () => hoisted.isMobile,
  isTablet: () => hoisted.isTablet,
  IntercomService: { askQuestion: hoisted.intercomMock },
  Logger: { error: hoisted.loggerErrorMock },
  WalletStorage: { getHideBalances: hoisted.getHideMock, setHideBalances: hoisted.setHideMock }
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatPriceUsd: (v: string) => `$${v}`,
  formatUsd: (v: string) => `$${v}`,
  formatMobileAmount: (v: unknown) => String(v),
  formatMobileUsd: (v: unknown) => String(v)
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getCurrencyByTicker: (t: string) => ({ ibcData: `ibc/${t}`, shortName: t }),
  getCurrencyByDenom: (d: string) => ({ shortName: d, name: d })
}));

vi.mock("./leaseSize", () => ({
  buildLeaseSizeCell: () => ({ value: "SIZE", subValue: "SUB" })
}));

vi.mock("@/config/global", () => ({
  NATIVE_CURRENCY: { symbol: "NLS" },
  UPDATE_LEASES: 100000
}));

vi.mock("@/router", () => ({ RouteNames: { LEASES: "leases" } }));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: hoisted.routerPushMock })
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: { value: "en" } })
}));

vi.mock("@/common/components/BigNumber.vue", () => ({
  default: {
    name: "BigNumber",
    props: ["label", "amount"],
    template: `<div data-test="bignumber" :data-label="label" :data-value="amount.value"></div>`
  }
}));

vi.mock("@/common/components/ListHeader.vue", () => ({
  default: {
    name: "ListHeader",
    props: ["title"],
    template: `<div data-test="listheader"><slot /></div>`
  }
}));

vi.mock("@/common/components/EmptyState.vue", () => ({
  default: {
    name: "EmptyState",
    props: ["slider"],
    template: `<div data-test="empty"></div>`
  }
}));

vi.mock("@/modules/leases/components/single-lease/SharePnLDialog.vue", () => ({
  default: {
    name: "SharePnLDialog",
    methods: { show() {} },
    template: `<div data-test="share"></div>`
  }
}));

vi.mock("./single-lease/Action.vue", () => ({
  default: {
    name: "Action",
    props: ["lease", "showClose", "showDetails"],
    template: `<div data-test="action"></div>`
  }
}));

vi.mock("web-components", () => ({
  AlertType: { info: "info", success: "success", warning: "warning", error: "error" },
  Alert: {
    name: "Alert",
    props: ["title", "type", "showClose", "onClose"],
    template: `<div data-test="alert" :data-type="type">
      <span data-test="alert-title">{{ title }}</span>
      <slot name="content" />
      <button v-if="showClose" data-test="alert-close" @click="onClose && onClose()"></button>
    </div>`
  },
  Button: {
    name: "Button",
    props: ["label", "severity", "size", "disabled", "loading"],
    emits: ["click"],
    template: `<button data-test="btn" @click="$emit('click')">{{ label }}</button>`
  },
  Widget: {
    name: "Widget",
    template: `<div data-test="widget"><slot /></div>`
  },
  Table: {
    name: "Table",
    props: ["searchable", "size", "columns", "tableWrapperClasses", "tableClasses", "scrollable", "hideValues"],
    emits: ["hide-value", "onSearchClear", "on-input"],
    template: `<div data-test="table">
      <input data-test="search" @input="$emit('on-input', $event)" />
      <button data-test="hide" @click="$emit('hide-value', true)"></button>
      <slot />
      <slot name="body" />
    </div>`
  },
  TableRow: {
    name: "TableRow",
    props: ["items", "scrollable"],
    // Render each cell so the leasesData render closures (skeletons, the
    // actions cell) actually execute, not just get defined.
    template: `<div data-test="row">
      <template v-for="(it, i) in items" :key="i">
        <component v-if="it.component" :is="it.component" v-bind="it.componentProps || {}" />
        <span v-else data-test="cell" @click="it.click && it.click()">{{ it.value }}</span>
      </template>
    </div>`
  }
}));

import { mount, flushPromises } from "@vue/test-utils";
import Leases from "./Leases.vue";

function leaseFixture(overrides: Record<string, unknown> = {}) {
  return {
    address: "nolus1aaaaaaaa12345678",
    status: "opened",
    protocol: "OSMOSIS-OSMOSIS-USDC",
    amount: { ticker: "OSMO", amount: "1000000" },
    debt: { ticker: "OSMO" },
    etl_data: { lease_position_ticker: "OSMO" },
    in_progress: null,
    ...overrides
  };
}

function display(overrides: Record<string, unknown> = {}) {
  return {
    pnlPercent: new Dec("12.34"),
    pnlAmount: new Dec("100"),
    pnlPositive: true,
    unitAsset: new Dec("1"),
    assetValueUsd: new Dec("1000"),
    inProgressType: null,
    liquidationPrice: new Dec("50000"),
    totalDebtUsd: new Dec("500"),
    downPayment: new Dec("400"),
    repaymentValue: new Dec("0"),
    ...overrides
  };
}

function factory() {
  return mount(Leases, {
    global: {
      mocks: { $t: (k: string) => k },
      stubs: { "router-view": true }
    }
  });
}

describe("Leases.vue — characterization (pre-composable extraction)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.loading = false;
    hoisted.leasesArr = [];
    hoisted.failedOpensArr = [];
    hoisted.pricesState = {};
    hoisted.walletState = { wallet: null };
    hoisted.protocolFilter = "OSMOSIS";
    hoisted.activeProtocols = ["OSMOSIS-OSMOSIS-USDC"];
    hoisted.protocols = {};
    hoisted.currenciesData = {};
    hoisted.assetIcons = {};
    hoisted.positionType = "Long";
    hoisted.protocolDisabled = false;
    hoisted.isMobile = false;
    hoisted.isTablet = false;
    hoisted.getHideMock.mockReturnValue(false);
    hoisted.displayDataFn.mockImplementation(() => display());
  });

  it("renders the empty state when no leases pass the network filter", async () => {
    hoisted.leasesArr = [];
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find("[data-test='empty']").exists()).toBe(true);
    expect(wrapper.findAll("[data-test='row']").length).toBe(0);
    wrapper.unmount();
  });

  it("renders one table row per network-filtered lease", async () => {
    hoisted.leasesArr = [leaseFixture({ address: "nolus1aa" }), leaseFixture({ address: "nolus1bb" })];
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find("[data-test='empty']").exists()).toBe(false);
    expect(wrapper.findAll("[data-test='row']").length).toBe(2);
    wrapper.unmount();
  });

  it("excludes leases whose protocol is neither active nor network-matched", async () => {
    hoisted.activeProtocols = ["OSMOSIS-OSMOSIS-USDC"];
    hoisted.protocols = { "NEUTRON-ASTROPORT-USDC": { network: "NEUTRON" } };
    hoisted.leasesArr = [
      leaseFixture({ address: "nolus1keep", protocol: "OSMOSIS-OSMOSIS-USDC" }),
      leaseFixture({ address: "nolus1drop", protocol: "NEUTRON-ASTROPORT-USDC" })
    ];
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.findAll("[data-test='row']").length).toBe(1);
    wrapper.unmount();
  });

  it("filters rows by the search term against ticker", async () => {
    hoisted.leasesArr = [
      leaseFixture({ address: "nolus1osmo", amount: { ticker: "OSMO" }, etl_data: { lease_position_ticker: "OSMO" } }),
      leaseFixture({ address: "nolus1atom", amount: { ticker: "ATOM" }, etl_data: { lease_position_ticker: "ATOM" } })
    ];
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.findAll("[data-test='row']").length).toBe(2);

    const search = wrapper.find("[data-test='search']");
    (search.element as HTMLInputElement).value = "atom";
    await search.trigger("input");
    await flushPromises();

    expect(wrapper.findAll("[data-test='row']").length).toBe(1);
    wrapper.unmount();
  });

  it("aggregates pnl, active-lease value and debt across opened leases", async () => {
    hoisted.leasesArr = [leaseFixture({ address: "nolus1aa" }), leaseFixture({ address: "nolus1bb" })];
    const wrapper = factory();
    await flushPromises();

    const values = wrapper.findAll("[data-test='bignumber']").map((n) => n.attributes("data-value"));
    // Two leases, each pnlAmount 100 / assetValueUsd 1000 / totalDebtUsd 500.
    expect(values).toContain("200.00"); // unrealized pnl
    expect(values).toContain("2000.00"); // active leases value
    expect(values).toContain("1000.00"); // debt
    wrapper.unmount();
  });

  it("persists the hide-balances toggle through WalletStorage", async () => {
    hoisted.leasesArr = [leaseFixture()];
    const wrapper = factory();
    await flushPromises();

    await wrapper.find("[data-test='hide']").trigger("click");
    await flushPromises();

    expect(hoisted.setHideMock).toHaveBeenCalledWith(true);
    wrapper.unmount();
  });

  it("shows the new-lease button only with a connected wallet and an enabled protocol", async () => {
    hoisted.walletState = { wallet: null };
    const noWallet = factory();
    await flushPromises();
    expect(noWallet.findAll("[data-test='btn']").map((b) => b.text())).not.toContain("message.new-lease");
    noWallet.unmount();

    hoisted.walletState = { wallet: { address: "nolus1xyz" } };
    hoisted.protocolDisabled = false;
    const connected = factory();
    await flushPromises();
    expect(connected.findAll("[data-test='btn']").map((b) => b.text())).toContain("message.new-lease");
    connected.unmount();

    hoisted.protocolDisabled = true;
    const disabled = factory();
    await flushPromises();
    expect(disabled.findAll("[data-test='btn']").map((b) => b.text())).not.toContain("message.new-lease");
    disabled.unmount();
  });

  it("renders the mobile layout for a short position without throwing", async () => {
    hoisted.isMobile = true;
    hoisted.positionType = "Short";
    hoisted.pricesState = { "OSMO@OSMOSIS-OSMOSIS-USDC": { price: "2" } };
    hoisted.leasesArr = [leaseFixture()];
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.findAll("[data-test='row']").length).toBe(1);
    expect(hoisted.loggerErrorMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("renders progress titles for in-progress leases", async () => {
    hoisted.leasesArr = [
      leaseFixture({ address: "nolus1opening", status: "opening", in_progress: null }),
      leaseFixture({ address: "nolus1closing", status: "opened", in_progress: { close: {} } }),
      leaseFixture({ address: "nolus1repay", status: "opened", in_progress: { repayment: {} } })
    ];
    const wrapper = factory();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain("message.opening");
    expect(text).toContain("message.closing");
    expect(text).toContain("message.repaying");
    wrapper.unmount();
  });

  it("provides a reload handler that refreshes leases and balances", async () => {
    const wrapper = factory();
    await flushPromises();
    const reload = (wrapper.vm as unknown as { $: { provides: Record<string, () => void> } }).$.provides.reload;
    expect(typeof reload).toBe("function");
    if (reload === undefined) throw new Error("expected a reload handler to be provided");
    hoisted.refreshMock.mockClear();
    reload();
    expect(hoisted.refreshMock).toHaveBeenCalledTimes(1);
    expect(hoisted.fetchBalancesMock).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("refreshes on mount, polls on the update interval, and stops after unmount", async () => {
    vi.useFakeTimers();
    hoisted.leasesArr = [leaseFixture()];
    const wrapper = factory();

    expect(hoisted.refreshMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100000);
    expect(hoisted.refreshMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(100000);
    expect(hoisted.refreshMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("renders a failed-open alert with the title and the entry reason", async () => {
    hoisted.failedOpensArr = [{ address: "nolus1failed", reason: "unexpected operation response" }];
    const wrapper = factory();
    await flushPromises();

    const alert = wrapper.find("[data-test='alert']");
    expect(alert.exists()).toBe(true);
    expect(wrapper.find("[data-test='alert-title']").text()).toBe("message.open-failed-title");
    expect(alert.text()).toContain("message.open-failed-refund-description");
    expect(alert.text()).toContain("unexpected operation response");
    wrapper.unmount();
  });

  it("dismissing a failed-open alert calls the store dismiss action with its address", async () => {
    hoisted.failedOpensArr = [{ address: "nolus1failed", reason: "timeout" }];
    const wrapper = factory();
    await flushPromises();

    await wrapper.find("[data-test='alert-close']").trigger("click");
    expect(hoisted.dismissFailedOpenMock).toHaveBeenCalledWith("nolus1failed");
    wrapper.unmount();
  });

  it("renders no failed-open alert when there are no failed opens", async () => {
    hoisted.failedOpensArr = [];
    const wrapper = factory();
    await flushPromises();

    expect(wrapper.find("[data-test='alert']").exists()).toBe(false);
    wrapper.unmount();
  });
});
