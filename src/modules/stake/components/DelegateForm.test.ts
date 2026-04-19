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
  const simulateDelegateTx = vi.fn();
  const broadcastTx = vi.fn();
  const fetchPositions = vi.fn();
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const loadDelegatorValidators = vi.fn();
  const loadValidators = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const validateAmountV2Mock = vi.fn((_a: string, _b: string) => "");
  const routerPush = vi.fn();
  const walletRef: {
    value: { simulateDelegateTx: typeof simulateDelegateTx; broadcastTx: typeof broadcastTx } | null;
  } = {
    value: { simulateDelegateTx, broadcastTx }
  };
  const balancesRef: { nativeBalance: { amount: string } | null } = {
    nativeBalance: { amount: "1000000000" } // 1000 NLS
  };
  const pricesState: Record<string, { price: string }> = { "NLS@NOLUS": { price: "0.5" } };

  return {
    simulateDelegateTx,
    broadcastTx,
    fetchPositions,
    fetchBalances,
    loadActivities,
    loadDelegatorValidators,
    loadValidators,
    walletOperationMock,
    validateAmountV2Mock,
    routerPush,
    walletRef,
    balancesRef,
    pricesState
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
    get nativeBalance() {
      return hoisted.balancesRef.nativeBalance;
    },
    fetchBalances: hoisted.fetchBalances
  })
}));

vi.mock("@/common/stores/staking", () => ({
  useStakingStore: () => ({ fetchPositions: hoisted.fetchPositions })
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

vi.mock("@/common/utils", () => ({
  Logger: { error: vi.fn() },
  NetworkUtils: {
    loadDelegatorValidators: hoisted.loadDelegatorValidators,
    loadValidators: hoisted.loadValidators
  },
  Utils: { getRandomInt: () => 0 },
  validateAmountV2: hoisted.validateAmountV2Mock,
  walletOperation: hoisted.walletOperationMock
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => v,
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getCurrencyByTicker: (_ticker: string) => ({ key: "NLS@NOLUS" })
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: hoisted.routerPush })
}));

vi.mock("@/router", () => ({
  RouteNames: { STAKE: "stake" }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

// Mock the AdvancedFormControl to be a simple input-emitting component so tests can drive input
vi.mock("web-components", () => ({
  AdvancedFormControl: {
    name: "AdvancedFormControl",
    props: [
      "id",
      "currencyOptions",
      "labelAdvanced",
      "balanceLabel",
      "selectedCurrencyOption",
      "placeholder",
      "calculatedBalance",
      "errorMsg",
      "inputClass"
    ],
    emits: ["input"],
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
    props: ["size", "severity", "label", "loading"],
    emits: ["click"],
    template: '<button data-test="submit" :disabled="loading" @click="$emit(\'click\')">{{ label }}</button>'
  },
  SvgIcon: { name: "SvgIcon", props: ["name"], template: "<i />" },
  ToastType: { success: "success", error: "error" }
}));

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import DelegateForm from "./DelegateForm.vue";

function factory() {
  return mount(DelegateForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: {
        onShowToast: vi.fn()
      }
    }
  });
}

describe("DelegateForm.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = {
      simulateDelegateTx: hoisted.simulateDelegateTx,
      broadcastTx: hoisted.broadcastTx
    };
    hoisted.balancesRef.nativeBalance = { amount: "1000000000" };
    hoisted.pricesState["NLS@NOLUS"] = { price: "0.5" };
    hoisted.simulateDelegateTx.mockResolvedValue({ txBytes: new Uint8Array([9]) });
    hoisted.broadcastTx.mockResolvedValue({});
    hoisted.fetchPositions.mockResolvedValue(undefined);
    hoisted.fetchBalances.mockResolvedValue(undefined);
    hoisted.loadDelegatorValidators.mockResolvedValue([
      { operator_address: "nolusvaloperA", commission: { commission_rates: { rate: "0.05" } } }
    ]);
    hoisted.loadValidators.mockResolvedValue([]);
    hoisted.validateAmountV2Mock.mockReturnValue("");
    hoisted.walletOperationMock.mockImplementation(async (op: () => Promise<void> | void) => {
      await op();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing", () => {
    const wrapper = factory();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it("submit button shows delegate label", () => {
    const wrapper = factory();
    expect(wrapper.find('[data-test="submit"]').text()).toBe("message.delegate");
    wrapper.unmount();
  });

  it("surfaces validation error when validateAmountV2 returns a non-empty string", async () => {
    hoisted.validateAmountV2Mock.mockReturnValue("message.invalid-balance-big");

    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("9999999");
    await nextTick();

    expect(wrapper.find('[data-test="error"]').text()).toBe("message.invalid-balance-big");
    wrapper.unmount();
  });

  it("does not call simulateDelegateTx when validation fails", async () => {
    hoisted.validateAmountV2Mock.mockReturnValue("message.invalid-balance-big");

    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("9999999");
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(hoisted.simulateDelegateTx).not.toHaveBeenCalled();
    expect(hoisted.walletOperationMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("calls simulateDelegateTx and broadcastTx on valid submit", async () => {
    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("100");
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));

    expect(hoisted.walletOperationMock).toHaveBeenCalledTimes(1);
    expect(hoisted.simulateDelegateTx).toHaveBeenCalledTimes(1);
    expect(hoisted.broadcastTx).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("refreshes positions/balances/history and navigates after success", async () => {
    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("100");
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));

    expect(hoisted.fetchPositions).toHaveBeenCalled();
    expect(hoisted.fetchBalances).toHaveBeenCalled();
    expect(hoisted.loadActivities).toHaveBeenCalled();
    expect(hoisted.routerPush).toHaveBeenCalledWith("/stake");
    wrapper.unmount();
  });
});
