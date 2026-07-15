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
  const getCurrencyByTickerForNetworkMock = vi.fn(() => ({ ibcData: "ibc/OSMO" }));
  const getPriceForCurrencyMock = vi.fn(() => "1.0");
  const classifyErrorMock = vi.fn(() => "message.unexpected-error");
  const loggerErrorMock = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const externalWalletMock = vi.fn(async () => ({ address: "osmo1external" }));
  const getWalletMock = vi.fn();

  const clientMock = {
    getChainId: vi.fn(async () => "osmosis-1"),
    getBalance: vi.fn(async () => ({ denom: "uosmo", amount: "1000000" })),
    destroy: vi.fn()
  };

  const walletRef: { value: { address?: string; signer?: { chainId?: string; chain_id?: string } } | null } = {
    value: { address: "nolus1self", signer: { chainId: "nolus-1", chain_id: "nolus-1" } }
  };
  const configStoreState: { initialized: boolean; supportedNetworksData: unknown } = {
    initialized: true,
    supportedNetworksData: {}
  };
  const protocolFilterControl: { ref: { value: string } | null } = { ref: null };

  return {
    getSkipRouteConfigMock,
    tryGetCurrencyByDenomMock,
    getCurrencyByTickerForNetworkMock,
    getPriceForCurrencyMock,
    classifyErrorMock,
    loggerErrorMock,
    walletOperationMock,
    externalWalletMock,
    getWalletMock,
    clientMock,
    walletRef,
    configStoreState,
    protocolFilterControl
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
    filteredBalances: [],
    fetchBalances: vi.fn()
  })
}));

vi.mock("@/common/stores/config", async () => {
  const { ref } = (await vi.importActual("vue")) as { ref: (value: string) => { value: string } };
  hoisted.protocolFilterControl.ref = ref("OSMOSIS");
  return {
    useConfigStore: () => ({
      get initialized() {
        return hoisted.configStoreState.initialized;
      },
      get protocolFilter() {
        return hoisted.protocolFilterControl.ref?.value ?? "";
      },
      get supportedNetworksData() {
        return hoisted.configStoreState.supportedNetworksData;
      }
    })
  };
});

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: vi.fn(), addPendingTransfer: vi.fn() })
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: hoisted.loggerErrorMock },
  classifyError: hoisted.classifyErrorMock,
  walletOperation: hoisted.walletOperationMock,
  externalWallet: hoisted.externalWalletMock,
  WalletAccess: { isAuth: () => true, getWallet: hoisted.getWalletMock }
}));

vi.mock("@/common/utils/ConfigService", () => ({
  getSkipRouteConfig: hoisted.getSkipRouteConfigMock
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  tryGetCurrencyByDenom: hoisted.tryGetCurrencyByDenomMock,
  getCurrencyByTickerForNetwork: hoisted.getCurrencyByTickerForNetworkMock,
  getPriceForCurrency: hoisted.getPriceForCurrencyMock
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatUsd: (v: unknown) => `$${String(v)}`,
  formatDecAsUsd: (v: unknown) => `$${(v as { toString: () => string }).toString()}`,
  formatTokenBalance: (v: unknown) => (v as { toString: () => string }).toString()
}));

vi.mock("@/common/utils/SkipRoute", () => ({
  SkipRouter: {
    getRoute: vi.fn(async () => ({ chain_ids: [] })),
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
  getNetworkData: () => ({
    list: [
      { key: "OSMOSIS", value: "osmosis", native: false, label: "Osmosis" },
      { key: "NOLUS", value: "nolus", native: true, label: "Nolus" }
    ],
    supportedNetworks: {
      OSMOSIS: { value: "osmosis", ticker: "OSMO", fees: { transfer_amount: 1000 } }
    }
  })
}));

vi.mock("@/networks", () => ({}));

vi.mock("../../../config/global/network", () => ({
  NATIVE_NETWORK: { key: "NOLUS", transferEstimation: 30 }
}));

vi.mock("../../../config/global", () => ({
  IGNORED_NETWORKS: [] as string[]
}));

vi.mock("@/modules/history/types", () => ({
  HISTORY_ACTIONS: { SEND: "send", RECEIVE: "receive" }
}));

vi.mock("web-components", () => ({
  AdvancedFormControl: {
    name: "AdvancedFormControl",
    props: [
      "currencyOptions",
      "calculatedBalance",
      "value",
      "errorMsg",
      "selectedCurrencyOption",
      "disabledInputField",
      "disabledCurrencyPicker"
    ],
    emits: ["on-selected-currency", "input"],
    template: `<div><button data-test="amount-input" @click="$emit('input', $attrs['data-amount'] ?? '0.5')" /></div>`
  },
  Button: {
    name: "Button",
    props: ["size", "severity", "label", "loading", "disabled", "icon"],
    emits: ["click"],
    template:
      '<button data-test="submit" :disabled="loading || disabled" @click="$emit(\'click\')">{{ label }}</button>'
  },
  Input: {
    name: "Input",
    props: ["value", "disabled", "inputClass", "type"],
    emits: ["input"],
    template: "<input data-test='recipient' />"
  },
  AssetItem: { name: "AssetItem", template: "<div />" }
}));

import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { SkipRouter } from "@/common/utils/SkipRoute";
import ReceiveForm from "./ReceiveForm.vue";

const OSMO_CURRENCY = {
  key: "OSMO@OSMOSIS",
  name: "Osmosis",
  shortName: "OSMO",
  ticker: "OSMO",
  symbol: "OSMO",
  icon: "",
  ibcData: "ibc/OSMO",
  decimal_digits: 6,
  native: false
};

function factory() {
  return mount(ReceiveForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: { close: vi.fn() }
    }
  });
}

function findAmountInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: "AdvancedFormControl" });
}

describe("ReceiveForm.vue — characterization (pre-useTransferForm extraction)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());

    hoisted.configStoreState.initialized = true;
    if (hoisted.protocolFilterControl.ref) {
      hoisted.protocolFilterControl.ref.value = "OSMOSIS";
    }
    hoisted.walletRef.value = { address: "nolus1self", signer: { chainId: "nolus-1", chain_id: "nolus-1" } };
    hoisted.getWalletMock.mockResolvedValue(hoisted.clientMock);
    hoisted.externalWalletMock.mockResolvedValue({ address: "osmo1external" });
    hoisted.clientMock.getChainId.mockResolvedValue("osmosis-1");
    hoisted.clientMock.getBalance.mockResolvedValue({ denom: "uosmo", amount: "1000000" });
    (SkipRouter.getRoute as ReturnType<typeof vi.fn>).mockResolvedValue({ chain_ids: [] });

    hoisted.getSkipRouteConfigMock.mockResolvedValue({
      blacklist: [],
      swap_to_currency: "ibc/USDC",
      fee: 25,
      transfers: {
        OSMOSIS: {
          currencies: [{ from: "ibc/OSMO", to: "uosmo", native: false }]
        }
      }
    });

    hoisted.tryGetCurrencyByDenomMock.mockImplementation((denom: string) => {
      if (denom === "ibc/OSMO" || denom === "uosmo") {
        return { ...OSMO_CURRENCY };
      }
      return null;
    });
  });

  it("renders without throwing and resolves the external destination wallet", async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it("builds the asset list from the network's configured currencies", async () => {
    const wrapper = factory();
    await flushPromises();
    const options = findAmountInput(wrapper).props("currencyOptions") as unknown[];
    expect(options.length).toBe(1);
    wrapper.unmount();
  });

  it("re-runs onInit when the wallet-driven protocolFilter changes (#226 watch)", async () => {
    const pf = hoisted.protocolFilterControl.ref;
    expect(pf).toBeTruthy();
    if (!pf) return;

    const wrapper = factory();
    await flushPromises();
    const initialConfigCalls = hoisted.getSkipRouteConfigMock.mock.calls.length;
    expect(initialConfigCalls).toBeGreaterThan(0);

    pf.value = "NEUTRON";
    await flushPromises();

    expect(hoisted.getSkipRouteConfigMock.mock.calls.length).toBeGreaterThan(initialConfigCalls);
    wrapper.unmount();
  });

  describe("route fetch (debounced)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls getRoute with RECEIVE source/sink order: (asset.balance.denom, asset.from)", async () => {
      const wrapper = factory();
      await flushPromises();

      vi.useFakeTimers();
      findAmountInput(wrapper).vm.$emit("input", "0.5");
      await vi.advanceTimersByTimeAsync(700);

      expect(SkipRouter.getRoute).toHaveBeenCalled();
      const args = (SkipRouter.getRoute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(args).toBeDefined();
      if (!args) return;
      // Receive reverses Send: source = on-chain balance denom, sink = the IBC `from`.
      expect(args[0]).toBe("uosmo"); // source = asset.balance.denom
      expect(args[1]).toBe("ibc/OSMO"); // sink = asset.from
      expect(args[3]).toBe(false); // revert flag
      wrapper.unmount();
    });

    it("surfaces invalid-balance-big when amount exceeds wallet balance", async () => {
      const wrapper = factory();
      await flushPromises();

      vi.useFakeTimers();
      findAmountInput(wrapper).vm.$emit("input", "999");
      await vi.advanceTimersByTimeAsync(700);

      expect(findAmountInput(wrapper).props("errorMsg")).toBe("message.invalid-balance-big");
      expect(SkipRouter.getRoute).not.toHaveBeenCalled();
      wrapper.unmount();
    });

    it("classifies a thrown getRoute error onto amountErrorMsg", async () => {
      (SkipRouter.getRoute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
      const wrapper = factory();
      await flushPromises();

      vi.useFakeTimers();
      findAmountInput(wrapper).vm.$emit("input", "0.5");
      await vi.advanceTimersByTimeAsync(700);

      expect(hoisted.classifyErrorMock).toHaveBeenCalled();
      expect(findAmountInput(wrapper).props("errorMsg")).toBe("message.unexpected-error");
      wrapper.unmount();
    });

    it("clears the pending route-fetch debounce on unmount", async () => {
      const wrapper = factory();
      await flushPromises();

      vi.useFakeTimers();
      findAmountInput(wrapper).vm.$emit("input", "0.5");
      await nextTick();

      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(700);

      expect(SkipRouter.getRoute).not.toHaveBeenCalled();
    });
  });
});
