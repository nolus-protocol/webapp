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
  const getPriceForCurrencyMock = vi.fn(() => "1.0");
  const classifyErrorMock = vi.fn(() => "message.unexpected-error");
  const loggerErrorMock = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const externalWalletMock = vi.fn(async () => ({ address: "osmo1recipient" }));
  const getWalletMock = vi.fn();
  const transferCurrencyMock = vi.fn();
  // validateAddress now takes the destination network's chain type
  // as a 2nd arg (the receiver-address watcher passes it; onSubmitNative stays
  // cosmos by passing the native cosmos chain type / omitting it). The stub
  // ignores args, so this documents the new call shape without asserting it.
  const validateAddressMock = vi.fn((_address: string, _chainType?: unknown) => "");

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
    getPriceForCurrencyMock,
    classifyErrorMock,
    loggerErrorMock,
    walletOperationMock,
    externalWalletMock,
    getWalletMock,
    transferCurrencyMock,
    validateAddressMock,
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
    getBalanceInfo: (_denom: string) => ({ denom: "uosmo", amount: "1000000" }),
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
  transferCurrency: hoisted.transferCurrencyMock,
  validateAddress: hoisted.validateAddressMock,
  WalletAccess: { isAuth: () => true, getWallet: hoisted.getWalletMock }
}));

vi.mock("@/common/utils/ConfigService", () => ({
  getSkipRouteConfig: hoisted.getSkipRouteConfigMock
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  tryGetCurrencyByDenom: hoisted.tryGetCurrencyByDenomMock,
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

// `../../../config/global` and `@/config/global` resolve to the same module;
// both specifiers must expose every symbol the component reads from it.
vi.mock("../../../config/global", () => ({
  IGNORED_NETWORKS: [] as string[],
  ErrorCodes: { GasError: 11 }
}));
vi.mock("@/config/global", () => ({
  IGNORED_NETWORKS: [] as string[],
  ErrorCodes: { GasError: 11 }
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
import SendForm from "./SendForm.vue";

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
  return mount(SendForm, {
    global: {
      mocks: { $t: (k: string) => k },
      provide: { close: vi.fn() }
    }
  });
}

function findAmountInput(wrapper: ReturnType<typeof mount>) {
  return wrapper.findComponent({ name: "AdvancedFormControl" });
}

describe("SendForm.vue — characterization (pre-useTransferForm extraction)", () => {
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
    hoisted.externalWalletMock.mockResolvedValue({ address: "osmo1recipient" });
    hoisted.clientMock.getChainId.mockResolvedValue("osmosis-1");
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

  it("renders without throwing and lands on the wallet-owned cosmos network", async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
    // setCosmosNetwork resolved the destination wallet address.
    const recipient = wrapper.findComponent({ name: "Input" });
    expect(recipient.props("value")).toBe("osmo1recipient");
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

    // The async wallet reconnect resolves the owned network after mount; the
    // watch must react and repopulate rather than snapshot the first value once.
    pf.value = "NEUTRON";
    await flushPromises();

    expect(hoisted.getSkipRouteConfigMock.mock.calls.length).toBeGreaterThan(initialConfigCalls);
    wrapper.unmount();
  });

  describe("route fetch (debounced)", () => {
    // onInit drains under real timers (so setCosmosNetwork's amount reset lands
    // before we type); fake timers then drive the debounce deterministically.
    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls getRoute with SEND source/sink order: (asset.from, asset.balance.denom)", async () => {
      const wrapper = factory();
      await flushPromises();

      vi.useFakeTimers();
      findAmountInput(wrapper).vm.$emit("input", "0.5");
      await vi.advanceTimersByTimeAsync(700);

      expect(SkipRouter.getRoute).toHaveBeenCalled();
      const args = (SkipRouter.getRoute as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(args).toBeDefined();
      if (!args) return;
      expect(args[0]).toBe("ibc/OSMO"); // source = asset.from
      expect(args[1]).toBe("uosmo"); // sink = asset.balance.denom
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
      // nextTick runs the watch (microtask) so the debounce timer is scheduled,
      // WITHOUT advancing the clock to fire it; unmount must then clear it.
      findAmountInput(wrapper).vm.$emit("input", "0.5");
      await nextTick();

      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(700);

      expect(SkipRouter.getRoute).not.toHaveBeenCalled();
    });
  });
});
