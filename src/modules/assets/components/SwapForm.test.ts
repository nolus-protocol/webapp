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
  const getSkipRouteConfigMock = vi.fn();
  const tryGetCurrencyByDenomMock = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const validateAmountV2Mock = vi.fn((_a: string, _b: string) => "");
  const loggerErrorMock = vi.fn();

  const walletRef: { value: { signer?: { type?: string; chainId?: string } } | null } = {
    value: { signer: { type: "cosm", chainId: "nolus-1" } }
  };
  const pricesState: Record<string, { price: string }> = {
    "OSMO@OSMOSIS": { price: "1.0" },
    "USDC@OSMOSIS": { price: "1.0" },
    "NLS@NOLUS": { price: "0.5" }
  };
  const configStoreState: { initialized: boolean; protocolFilter: string; supportedNetworksData: unknown } = {
    initialized: true,
    protocolFilter: "OSMOSIS",
    supportedNetworksData: {}
  };
  const balancesState = { ignoredCurrencies: [] as string[] };

  return {
    getSkipRouteConfigMock,
    tryGetCurrencyByDenomMock,
    walletOperationMock,
    validateAmountV2Mock,
    loggerErrorMock,
    walletRef,
    pricesState,
    configStoreState,
    balancesState
  };
});

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({
    get wallet() {
      return hoisted.walletRef.value;
    },
    history: {}
  })
}));

vi.mock("@/common/stores/balances", () => ({
  useBalancesStore: () => ({
    get ignoredCurrencies() {
      return hoisted.balancesState.ignoredCurrencies;
    },
    getBalance: (_denom: string) => "1000000",
    fetchBalances: vi.fn()
  })
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
      return hoisted.configStoreState.initialized;
    },
    get protocolFilter() {
      return hoisted.configStoreState.protocolFilter;
    },
    get supportedNetworksData() {
      return hoisted.configStoreState.supportedNetworksData;
    }
  })
}));

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: vi.fn() })
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: hoisted.loggerErrorMock },
  validateAmountV2: hoisted.validateAmountV2Mock,
  walletOperation: hoisted.walletOperationMock,
  externalWallet: vi.fn(),
  WalletUtils: { isAuth: () => true, getWallet: vi.fn() }
}));

vi.mock("@/common/utils/ConfigService", () => ({
  getSkipRouteConfig: hoisted.getSkipRouteConfigMock
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  tryGetCurrencyByDenom: hoisted.tryGetCurrencyByDenomMock
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => v,
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`,
  formatTokenBalance: (v: unknown) => (v as { toString: () => string }).toString()
}));

vi.mock("@/common/utils/SkipRoute", () => ({
  SkipRouter: {
    getRoute: vi.fn(),
    submitRoute: vi.fn(),
    track: vi.fn(),
    fetchStatus: vi.fn(),
    getChains: vi.fn(async () => [])
  }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("@/networks/config", () => ({
  NETWORK_DATA: { supportedNetworks: {} }
}));

vi.mock("@/networks/types", () => ({
  WalletTypes: { evm: "evm", cosm: "cosm" }
}));

vi.mock("@/networks", () => ({}));

vi.mock("../../../config/global/network", () => ({
  NATIVE_NETWORK: {
    label: "Nolus",
    icon: "",
    longOperationsEstimation: 30
  }
}));

vi.mock("@/common/api/types/common", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
}));

// Mock web-components to simple stubs that expose the emit surface we need.
vi.mock("web-components", () => ({
  Button: {
    name: "Button",
    props: ["size", "severity", "label", "loading", "disabled"],
    emits: ["click"],
    template:
      '<button data-test="submit" :disabled="loading || disabled" @click="$emit(\'click\')">{{ label }}</button>'
  },
  AssetItem: { name: "AssetItem", template: "<div />" },
  ToastType: { success: "success", error: "error" }
}));

// Mock the MultipleCurrencyComponent so tests can fire the change events directly.
vi.mock("@/common/components/MultipleCurrencyComponent.vue", () => ({
  default: {
    name: "MultipleCurrencyComponent",
    props: [
      "currencyOptions",
      "itemsHeadline",
      "selectedFirstCurrencyOption",
      "selectedSecondCurrencyOption",
      "disabled",
      "firstInputValue",
      "secondInputValue",
      "firstCalculatedBalance",
      "secondCalculatedBalance",
      "errorMsg",
      "errorInsufficientBalance",
      "itemTemplate"
    ],
    emits: ["on-first-change", "on-second-change", "swap"],
    template: `
      <div>
        <button
          data-test="emit-first"
          @click="$emit('on-first-change', {
            input: { value: '10' },
            currency: { value: $attrs['data-first-value'] ?? 'OSMO@OSMOSIS' },
            type: 'select'
          })"
        />
        <button
          data-test="emit-second"
          @click="$emit('on-second-change', {
            input: { value: '10' },
            currency: { value: $attrs['data-second-value'] ?? 'USDC@OSMOSIS' },
            type: 'select'
          })"
        />
      </div>
    `
  }
}));

import { mount, flushPromises } from "@vue/test-utils";
import SwapForm from "./SwapForm.vue";

type ShowToastPayload = { type: string; message: string };

function factory(onShowToast: ReturnType<typeof vi.fn> = vi.fn()) {
  return mount(SwapForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: { onShowToast, close: vi.fn() }
    }
  });
}

describe("SwapForm.vue — defensive guards on .find()", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());

    hoisted.configStoreState.initialized = true;
    hoisted.configStoreState.protocolFilter = "OSMOSIS";
    hoisted.balancesState.ignoredCurrencies = [];
    hoisted.walletRef.value = { signer: { type: "cosm", chainId: "nolus-1" } };
    hoisted.validateAmountV2Mock.mockReturnValue("");

    // Default: two valid currencies wired through the config.
    hoisted.getSkipRouteConfigMock.mockResolvedValue({
      blacklist: [],
      swap_currency_osmosis: "ibc/OSMO",
      swap_currency_neutron: "ibc/NTRN",
      swap_to_currency: "ibc/USDC",
      fee: 25,
      transfers: {
        OSMOSIS: {
          currencies: [
            { from: "ibc/OSMO", to: "ibc/OSMO", native: true },
            { from: "ibc/USDC", to: "ibc/USDC", native: false }
          ]
        }
      }
    });

    hoisted.tryGetCurrencyByDenomMock.mockImplementation((denom: string) => {
      if (denom === "ibc/OSMO") {
        return {
          key: "OSMO@OSMOSIS",
          name: "Osmosis",
          shortName: "OSMO",
          ticker: "OSMO",
          icon: "",
          ibcData: "ibc/OSMO",
          decimal_digits: 6
        };
      }
      if (denom === "ibc/USDC") {
        return {
          key: "USDC@OSMOSIS",
          name: "USD Coin",
          shortName: "USDC",
          ticker: "USDC",
          icon: "",
          ibcData: "ibc/USDC",
          decimal_digits: 6
        };
      }
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing", async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  describe("onLoadConfig: swap_to_currency has no match in assets", () => {
    beforeEach(() => {
      hoisted.getSkipRouteConfigMock.mockResolvedValue({
        blacklist: [],
        swap_currency_osmosis: "ibc/OSMO",
        swap_currency_neutron: "ibc/NTRN",
        swap_to_currency: "ibc/UNKNOWN", // no matching asset
        fee: 25,
        transfers: {
          OSMOSIS: {
            currencies: [{ from: "ibc/OSMO", to: "ibc/OSMO", native: true }]
          }
        }
      });
    });

    it("does not crash and surfaces an error toast", async () => {
      const toast = vi.fn();
      const wrapper = factory(toast);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(toast).toHaveBeenCalledExactlyOnceWith({
        type: "error",
        message: "message.swap-config-mismatch"
      });
      wrapper.unmount();
    });

    it("logs the mismatch via Logger.error", async () => {
      const wrapper = factory();
      await flushPromises();

      expect(hoisted.loggerErrorMock).toHaveBeenCalled();
      const arg = hoisted.loggerErrorMock.mock.calls[0]?.[0];
      expect(String(arg)).toContain("missing");
      wrapper.unmount();
    });
  });

  describe("updateAmount: currency emitted by picker has no match", () => {
    it("does not crash and surfaces an error toast", async () => {
      const toast = vi.fn();
      const wrapper = factory(toast);
      await flushPromises();
      toast.mockClear();

      // Replace the first emitter's currency value with an unknown one via attrs.
      await wrapper.find('[data-test="emit-first"]').trigger("click", {});
      // The mock emits a fixed value 'OSMO@OSMOSIS' — to force a miss,
      // override the component's emit via props: use the exposed component.
      // Instead, dispatch directly by finding the MultipleCurrencyComponent.
      const mcc = wrapper.findComponent({ name: "MultipleCurrencyComponent" });
      mcc.vm.$emit("on-first-change", {
        input: { value: "5" },
        currency: { value: "DOES_NOT_EXIST" },
        type: "select"
      });
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(toast).toHaveBeenCalledWith({
        type: "error",
        message: "message.swap-currency-not-available"
      });
      wrapper.unmount();
    });
  });

  describe("updateSwapToAmount: currency emitted by picker has no match", () => {
    it("does not crash and surfaces an error toast", async () => {
      const toast = vi.fn();
      const wrapper = factory(toast);
      await flushPromises();
      toast.mockClear();

      const mcc = wrapper.findComponent({ name: "MultipleCurrencyComponent" });
      mcc.vm.$emit("on-second-change", {
        input: { value: "5" },
        currency: { value: "DOES_NOT_EXIST" },
        type: "select"
      });
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      const calls = toast.mock.calls.map((c) => c[0] as ShowToastPayload);
      expect(calls).toContainEqual({
        type: "error",
        message: "message.swap-currency-not-available"
      });
      wrapper.unmount();
    });

    it("same guard fires for an 'input' event type (not just 'select')", async () => {
      const toast = vi.fn();
      const wrapper = factory(toast);
      await flushPromises();
      toast.mockClear();

      const mcc = wrapper.findComponent({ name: "MultipleCurrencyComponent" });
      mcc.vm.$emit("on-second-change", {
        input: { value: "5" },
        currency: { value: "DOES_NOT_EXIST" },
        type: "input"
      });
      await flushPromises();

      const calls = toast.mock.calls.map((c) => c[0] as ShowToastPayload);
      expect(calls).toContainEqual({
        type: "error",
        message: "message.swap-currency-not-available"
      });
      wrapper.unmount();
    });
  });
});
