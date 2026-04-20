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
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const validateAmountV2Mock = vi.fn(() => "");
  const getMicroAmountMock = vi.fn((_denom: string, amount: string) => ({
    mAmount: { amount: { toString: () => (Number(amount) * 1e6).toString() } },
    coinMinimalDenom: "ibc/USDC"
  }));

  const walletRef: { value: { address: string; broadcastTx: typeof broadcastTx } | null } = {
    value: { address: "nolus1abc", broadcastTx }
  };

  const pricesState: Record<string, { price: string }> = {
    "USDC@OSMOSIS": { price: "1" }
  };

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
    contracts: { OSMOSIS: { lpp: "nolus1lppcontract" } } as Record<string, { lpp: string }>,
    getActiveProtocolsForNetwork: vi.fn((_f: string) => ["OSMOSIS"])
  };

  return {
    broadcastTx,
    fetchBalances,
    loadActivities,
    walletOperationMock,
    validateAmountV2Mock,
    getMicroAmountMock,
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
  useBalancesStore: () => ({ fetchBalances: hoisted.fetchBalances })
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

vi.mock("@/common/utils", () => ({
  Logger: { error: vi.fn() },
  getMicroAmount: hoisted.getMicroAmountMock,
  validateAmountV2: hoisted.validateAmountV2Mock,
  walletOperation: hoisted.walletOperationMock,
  WalletManager: { getWalletAddress: () => "nolus1fallback" }
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`,
  formatTokenBalance: (v: unknown) => (v as { toString: () => string }).toString()
}));

vi.mock("../../../config/global/network", () => ({
  NATIVE_NETWORK: { earnEstimation: 10 }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertDenomToMinimalDenom: (amt: string) => ({
      amount: { gt: () => false, toString: () => String(amt) }
    })
  },
  NolusClient: {
    getInstance: () => ({
      getCosmWasmClient: vi.fn().mockResolvedValue({})
    })
  }
}));

vi.mock("@nolus/nolusjs/build/contracts", () => ({
  Lpp: class {
    async getLenderDeposit() {
      return { amount: "1000000" };
    }
    async getPrice() {
      return {
        amount: { amount: "1" },
        amount_quote: { amount: "1" }
      };
    }
    async getLppBalance() {
      return { balance: { amount: "1000000000" } };
    }
    async simulateBurnDepositTx() {
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
import WithdrawForm from "./WithdrawForm.vue";

function factory(onShowToast: ReturnType<typeof vi.fn> = vi.fn()) {
  return mount(WithdrawForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: { onShowToast, close: vi.fn(), loadLPNCurrency: vi.fn() }
    }
  });
}

describe("WithdrawForm.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.configRef.initialized = true;
    hoisted.configRef.protocolFilter = "OSMOSIS";
    hoisted.configRef.lpn = [{ key: "USDC@OSMOSIS" }];
    hoisted.configRef.getActiveProtocolsForNetwork = vi.fn((_f: string) => ["OSMOSIS"]);
    hoisted.validateAmountV2Mock.mockReturnValue("");
    hoisted.walletOperationMock.mockImplementation(async (op: () => Promise<void> | void) => {
      await op();
    });
    hoisted.broadcastTx.mockResolvedValue({});
    hoisted.fetchBalances.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing with at least one asset", () => {
    const wrapper = factory();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  describe("empty assets template guard — bug #3", () => {
    beforeEach(() => {
      // Make `assets` computed return [] — no active protocols in the filter
      hoisted.configRef.getActiveProtocolsForNetwork = vi.fn(() => []);
    });

    it("does not crash rendering preview when assets is empty and input is positive", async () => {
      const wrapper = factory();
      // Directly set input.value to positive, bypassing onInput (validateInputs
      // has its own separate crash surface, out of scope for bug #3).
      (wrapper.vm as unknown as { input: string }).input = "100";
      await nextTick();
      // The `v-else` branch used to unconditionally evaluate
      // `assets[selectedCurrency].label` → TypeError. With the guard
      // (`v-else-if="assets[selectedCurrency]"`), the branch is skipped.
      expect(wrapper.exists()).toBe(true);
      // Preview block should be empty / absent
      expect(wrapper.html()).not.toContain("message.withdraw-rewards-preview");
    });
  });

  describe("missing LPN balance guard in transferAmount — bug #4", () => {
    it("shows an error toast and aborts when matching lpn balance is missing", async () => {
      const toast = vi.fn();
      const wrapper = factory(toast);

      // Wait for the immediate wallet watcher + fetchDepositBalance to settle,
      // so we can stomp the populated lpnBalances back to [].
      await new Promise((r) => setTimeout(r, 0));
      await nextTick();
      await new Promise((r) => setTimeout(r, 0));
      await nextTick();

      const vm = wrapper.vm as unknown as {
        lpnBalances: Array<unknown>;
        input: string;
      };
      vm.lpnBalances = [];
      vm.input = "50";
      await nextTick();

      await wrapper.find('[data-test="submit"]').trigger("click");
      // Allow microtasks to drain
      await new Promise((r) => setTimeout(r, 0));
      await nextTick();
      await new Promise((r) => setTimeout(r, 0));

      expect(toast).toHaveBeenCalledWith({
        type: "error",
        message: "message.unable-to-fetch-lpn-balance"
      });
      // Must NOT have proceeded to broadcast the tx
      expect(hoisted.broadcastTx).not.toHaveBeenCalled();
      wrapper.unmount();
    });
  });
});
