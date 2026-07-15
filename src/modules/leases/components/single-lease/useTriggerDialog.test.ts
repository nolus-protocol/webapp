/**
 * Direct unit tests for the useTriggerDialog composable — the mode/position
 * asymmetries the mounted-SFC characterization suites (StopLossDialog.test.ts,
 * TakeProfitDialog.test.ts) only touch tangentially. This file pins, at the
 * composable boundary, the four mode x position comparison-sign branches of
 * isAmountValid, the stop-loss-only error_percent guard, the mode-selected
 * success toast, and the getPercent zero-divisor guards (both branches, which
 * now mirror). The composable exposes amount + amountErrorMsg + the
 * onSendClick submit path; isAmountValid runs through the amount watcher and
 * getPercent through the submit path, so both are observed via that surface
 * rather than reaching into internals.
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
    configRef
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

vi.mock("@/router", () => ({ RouteNames: { LEASES: "leases" } }));

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
  usePricesStore: () => ({ prices: {} })
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
    NolusClient: { getInstance: () => ({ getCosmWasmClient: async () => ({}) }) }
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
  Dialog: {},
  ToastType: { success: "success", error: "error" }
}));

import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { useTriggerDialog, type TriggerMode } from "./useTriggerDialog";

type TriggerApi = ReturnType<typeof useTriggerDialog>;

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    address: "nolus1lease",
    status: "opened",
    protocol: "osmosis-1",
    amount: { ticker: "ATOM", amount: "1000000000" },
    close_policy: { take_profit: 100, stop_loss: 200 },
    etl_data: undefined,
    ...overrides
  };
}

function displayData(overrides: Record<string, unknown> = {}) {
  return {
    openingPrice: new Dec("10"),
    totalDebt: new Dec("0"),
    stableAsset: new Dec("1"),
    unitAsset: new Dec("1"),
    ...overrides
  };
}

function setup(mode: TriggerMode, onShowToast = vi.fn()) {
  let api!: TriggerApi;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useTriggerDialog(mode);
        return () => null;
      }
    }),
    { global: { provide: { onShowToast, reload: vi.fn() } } }
  );
  return { api, wrapper, onShowToast };
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  hoisted.walletRef.value = { broadcastTx: hoisted.broadcastTx, address: "nolus1abc" };
  hoisted.configRef.positionType = "Long";
  hoisted.getLease.mockReturnValue(makeLease());
  hoisted.getLeaseDisplayData.mockReturnValue(displayData());
});

describe("useTriggerDialog — isAmountValid comparison-sign branches (mode x position)", () => {
  it("stop-loss / Long rejects an amount above the opening price with the max-amount error", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("10") }));
    const { api, wrapper } = setup("stop-loss");
    await wrapper.vm.$nextTick();

    api.amount.value = "50"; // 50 > opening price 10, percent 1/50 well under the guard
    await flushPromises();

    expect(api.amountErrorMsg.value, "stop-loss Long flags amount above opening price").toBe(
      "message.lease-only-max-error"
    );
    wrapper.unmount();
  });

  it("stop-loss / Short rejects an amount below the opening price with the min-amount error", async () => {
    hoisted.configRef.positionType = "Short";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("10") }));
    const { api, wrapper } = setup("stop-loss");
    await wrapper.vm.$nextTick();

    api.amount.value = "0.1"; // opening price 10 > 0.1, percent 0.1 under the guard
    await flushPromises();

    expect(api.amountErrorMsg.value, "stop-loss Short flags amount below opening price").toBe(
      "message.take-profit-min-amount-error"
    );
    wrapper.unmount();
  });

  it("take-profit / Long rejects an amount at or below the opening price with the min-amount error", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("10") }));
    const { api, wrapper } = setup("take-profit");
    await wrapper.vm.$nextTick();

    api.amount.value = "5"; // 5 <= opening price 10
    await flushPromises();

    expect(api.amountErrorMsg.value, "take-profit Long flags amount not above opening price").toBe(
      "message.take-profit-min-amount-error"
    );
    wrapper.unmount();
  });

  it("take-profit / Short rejects an amount above the opening price with the max-amount error", async () => {
    hoisted.configRef.positionType = "Short";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("10") }));
    const { api, wrapper } = setup("take-profit");
    await wrapper.vm.$nextTick();

    api.amount.value = "50"; // 50 > opening price 10
    await flushPromises();

    expect(api.amountErrorMsg.value, "take-profit Short flags amount above opening price").toBe(
      "message.lease-only-max-error"
    );
    wrapper.unmount();
  });

  it("clears the error for a valid stop-loss / Long amount within the opening price", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("100") }));
    const { api, wrapper } = setup("stop-loss");
    await wrapper.vm.$nextTick();

    api.amount.value = "50"; // 50 <= 100, percent 1/50 under the guard
    await flushPromises();

    expect(api.amountErrorMsg.value, "a valid stop-loss amount leaves no error").toBe("");
    wrapper.unmount();
  });
});

describe("useTriggerDialog — error_percent guard is stop-loss only", () => {
  it("stop-loss flags a position that exceeds the liquidation percent with the stop-loss error", async () => {
    hoisted.configRef.positionType = "Long";
    // stableAsset 100 / (amount 1 * unitAsset 1) = 100 >= error_percent 0.9
    hoisted.getLeaseDisplayData.mockReturnValue(
      displayData({ openingPrice: new Dec("100"), stableAsset: new Dec("100"), unitAsset: new Dec("1") })
    );
    const { api, wrapper } = setup("stop-loss");
    await wrapper.vm.$nextTick();

    api.amount.value = "1";
    await flushPromises();

    expect(api.amountErrorMsg.value, "stop-loss enforces the error_percent liquidation guard").toBe(
      "message.stop-loss-error"
    );
    wrapper.unmount();
  });

  it("take-profit does not apply the stop-loss error_percent guard for the same position shape", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(
      displayData({ openingPrice: new Dec("100"), stableAsset: new Dec("100"), unitAsset: new Dec("1") })
    );
    const { api, wrapper } = setup("take-profit");
    await wrapper.vm.$nextTick();

    api.amount.value = "1"; // 1 <= opening price 100 -> take-profit min-amount branch, never stop-loss-error
    await flushPromises();

    expect(api.amountErrorMsg.value, "take-profit never emits the stop-loss error").toBe(
      "message.take-profit-min-amount-error"
    );
    wrapper.unmount();
  });
});

describe("useTriggerDialog — mode-selected success toast", () => {
  it("emits the stop-loss toast on a completed stop-loss submit", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("100") }));
    const { api, wrapper, onShowToast } = setup("stop-loss");
    await wrapper.vm.$nextTick();
    api.amount.value = "50"; // valid: 50 <= 100, percent under guard
    await flushPromises();

    await api.onSendClick();
    await flushPromises();

    expect(hoisted.loggerError, "a clean stop-loss submit logs no error").not.toHaveBeenCalled();
    expect(onShowToast, "stop-loss submit surfaces the stop-loss toast key").toHaveBeenCalledWith(
      expect.objectContaining({ message: "message.stop-loss-toast" })
    );
    wrapper.unmount();
  });

  it("emits the take-profit toast on a completed take-profit submit", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(displayData({ openingPrice: new Dec("1") }));
    const { api, wrapper, onShowToast } = setup("take-profit");
    await wrapper.vm.$nextTick();
    api.amount.value = "50"; // valid take-profit Long: 50 > opening price 1
    await flushPromises();

    await api.onSendClick();
    await flushPromises();

    expect(hoisted.loggerError, "a clean take-profit submit logs no error").not.toHaveBeenCalled();
    expect(onShowToast, "take-profit submit surfaces the take-profit toast key").toHaveBeenCalledWith(
      expect.objectContaining({ message: "message.take-profit-toast" })
    );
    wrapper.unmount();
  });
});

describe("useTriggerDialog — getPercent zero-divisor guards (both branches mirror)", () => {
  it("stop-loss / Long tolerates a zero unit asset in isAmountValid without throwing", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(
      displayData({ openingPrice: new Dec("100"), stableAsset: new Dec("1"), unitAsset: new Dec("0") })
    );
    const { api, wrapper } = setup("stop-loss");
    await wrapper.vm.$nextTick();

    api.amount.value = "50"; // amount*unitAsset = 0 -> guard yields 0, no divide-by-zero
    await flushPromises();

    expect(api.amountErrorMsg.value, "zero unit asset skips the percent guard, reaches sign check").toBe("");
    wrapper.unmount();
  });

  it("stop-loss / Short tolerates a zero unit asset in isAmountValid without throwing", async () => {
    hoisted.configRef.positionType = "Short";
    hoisted.getLeaseDisplayData.mockReturnValue(
      displayData({ openingPrice: new Dec("1"), stableAsset: new Dec("1"), unitAsset: new Dec("0") })
    );
    const { api, wrapper } = setup("stop-loss");
    await wrapper.vm.$nextTick();

    api.amount.value = "50"; // unitAsset zero -> guard yields 0, no divide-by-zero
    await flushPromises();

    // opening price 1 not > 50, so the short sign check passes; guard must not have thrown
    expect(api.amountErrorMsg.value, "zero unit asset does not throw on the short path").toBe("");
    wrapper.unmount();
  });

  it("take-profit / Long submits without throwing when the unit asset is zero (getPercent guard)", async () => {
    hoisted.configRef.positionType = "Long";
    hoisted.getLeaseDisplayData.mockReturnValue(
      displayData({ openingPrice: new Dec("1"), stableAsset: new Dec("1"), unitAsset: new Dec("0") })
    );
    const { api, wrapper, onShowToast } = setup("take-profit");
    await wrapper.vm.$nextTick();
    api.amount.value = "50"; // valid take-profit Long
    await flushPromises();

    await api.onSendClick();
    await flushPromises();

    expect(hoisted.loggerError, "zero unit asset does not surface as a swallowed error").not.toHaveBeenCalled();
    expect(onShowToast, "the submit still completes and toasts").toHaveBeenCalledWith(
      expect.objectContaining({ message: "message.take-profit-toast" })
    );
    wrapper.unmount();
  });

  it("take-profit / Short submits without throwing when the unit asset is zero (getPercent guard)", async () => {
    hoisted.configRef.positionType = "Short";
    hoisted.getLeaseDisplayData.mockReturnValue(
      displayData({ openingPrice: new Dec("100"), stableAsset: new Dec("1"), unitAsset: new Dec("0") })
    );
    const { api, wrapper, onShowToast } = setup("take-profit");
    await wrapper.vm.$nextTick();
    api.amount.value = "50"; // valid take-profit Short: 50 <= opening price 100
    await flushPromises();

    await api.onSendClick();
    await flushPromises();

    expect(hoisted.loggerError, "zero unit asset does not surface as a swallowed error").not.toHaveBeenCalled();
    expect(onShowToast, "the submit still completes and toasts").toHaveBeenCalledWith(
      expect.objectContaining({ message: "message.take-profit-toast" })
    );
    wrapper.unmount();
  });
});
