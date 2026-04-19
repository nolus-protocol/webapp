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
  const simulateUndelegateTx = vi.fn();
  const broadcastTx = vi.fn();
  const fetchPositions = vi.fn();
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const validateAmountV2Mock = vi.fn(() => "");
  const routerPush = vi.fn();
  const walletRef: {
    value: { simulateUndelegateTx: typeof simulateUndelegateTx; broadcastTx: typeof broadcastTx } | null;
  } = {
    value: { simulateUndelegateTx, broadcastTx }
  };
  const stakingRef: {
    totalStaked: string;
    delegations: { balance: { amount: string }; validator_address: string }[];
  } = {
    totalStaked: "1000000000", // 1000 NLS
    delegations: [
      { balance: { amount: "600000000" }, validator_address: "nolusvaloperA" },
      { balance: { amount: "400000000" }, validator_address: "nolusvaloperB" }
    ]
  };
  const pricesState: Record<string, { price: string }> = { "NLS@NOLUS": { price: "0.5" } };

  return {
    simulateUndelegateTx,
    broadcastTx,
    fetchPositions,
    fetchBalances,
    loadActivities,
    walletOperationMock,
    validateAmountV2Mock,
    routerPush,
    walletRef,
    stakingRef,
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
  useBalancesStore: () => ({ fetchBalances: hoisted.fetchBalances })
}));

vi.mock("@/common/stores/staking", () => ({
  useStakingStore: () => ({
    get totalStaked() {
      return hoisted.stakingRef.totalStaked;
    },
    get delegations() {
      return hoisted.stakingRef.delegations;
    },
    fetchPositions: hoisted.fetchPositions
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

vi.mock("@/common/utils", () => ({
  Logger: { error: vi.fn() },
  formatDateTime: (d: string) => d,
  validateAmountV2: hoisted.validateAmountV2Mock,
  walletOperation: hoisted.walletOperationMock
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`,
  formatTokenBalance: (v: unknown) => (v as { toString: () => string }).toString()
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getCurrencyByTicker: () => ({ key: "NLS@NOLUS" })
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
import UndelegateForm from "./UndelegateForm.vue";

function factory() {
  return mount(UndelegateForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: { onShowToast: vi.fn() }
    }
  });
}

describe("UndelegateForm.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = {
      simulateUndelegateTx: hoisted.simulateUndelegateTx,
      broadcastTx: hoisted.broadcastTx
    };
    hoisted.simulateUndelegateTx.mockResolvedValue({ txBytes: new Uint8Array([1]) });
    hoisted.broadcastTx.mockResolvedValue({});
    hoisted.fetchPositions.mockResolvedValue(undefined);
    hoisted.fetchBalances.mockResolvedValue(undefined);
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

  it("renders undelegate submit button", () => {
    const wrapper = factory();
    expect(wrapper.find('[data-test="submit"]').text()).toBe("message.undelegate");
    wrapper.unmount();
  });

  it("shows validation error when amount exceeds staked balance", async () => {
    hoisted.validateAmountV2Mock.mockReturnValue("message.invalid-balance-big");
    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("999999");
    await nextTick();
    expect(wrapper.find('[data-test="error"]').text()).toBe("message.invalid-balance-big");
    wrapper.unmount();
  });

  it("does not call simulateUndelegateTx when validation fails", async () => {
    hoisted.validateAmountV2Mock.mockReturnValue("message.invalid-balance-big");
    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("999999");
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(hoisted.simulateUndelegateTx).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("splits amount across delegations when exceeding first delegation", async () => {
    const wrapper = factory();
    // 800 NLS should hit both delegations (600 + 400)
    await wrapper.find('[data-test="amount"]').setValue("800");
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));

    expect(hoisted.simulateUndelegateTx).toHaveBeenCalledTimes(1);
    const txs = hoisted.simulateUndelegateTx.mock.calls[0][0] as Array<{
      validator: string;
      amount: { amount: string };
    }>;
    expect(txs.length).toBe(2);
    const total = txs.reduce((acc, t) => acc + BigInt(t.amount.amount), 0n);
    expect(total).toBe(800_000_000n);
    wrapper.unmount();
  });

  it("refreshes stores and navigates after successful undelegate", async () => {
    const wrapper = factory();
    await wrapper.find('[data-test="amount"]').setValue("100");
    await wrapper.find('[data-test="submit"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));

    expect(hoisted.broadcastTx).toHaveBeenCalledTimes(1);
    expect(hoisted.fetchPositions).toHaveBeenCalled();
    expect(hoisted.fetchBalances).toHaveBeenCalled();
    expect(hoisted.loadActivities).toHaveBeenCalled();
    expect(hoisted.routerPush).toHaveBeenCalledWith("/stake");
    wrapper.unmount();
  });
});
