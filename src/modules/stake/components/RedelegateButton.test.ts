import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Shim window.matchMedia before any store import: ThemeManager (via @/common/utils)
// reads it at module init time and jsdom doesn't provide it.
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

// Hoisted mocks so factories can reference them
const hoisted = vi.hoisted(() => {
  const simulateRedelegateTx = vi.fn();
  const broadcastTx = vi.fn();
  const fetchPositions = vi.fn();
  const fetchBalances = vi.fn();
  const loadActivities = vi.fn();
  const loadDelegatorValidators = vi.fn();
  const loadValidators = vi.fn();
  const loggerError = vi.fn();

  const walletRef: {
    value: { simulateRedelegateTx: typeof simulateRedelegateTx; broadcastTx: typeof broadcastTx } | null;
  } = {
    value: {
      simulateRedelegateTx,
      broadcastTx
    }
  };

  return {
    simulateRedelegateTx,
    broadcastTx,
    fetchPositions,
    fetchBalances,
    loadActivities,
    loadDelegatorValidators,
    loadValidators,
    loggerError,
    walletRef
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

vi.mock("@/common/stores/staking", () => ({
  useStakingStore: () => ({ fetchPositions: hoisted.fetchPositions })
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: hoisted.loggerError },
  NetworkUtils: {
    loadDelegatorValidators: hoisted.loadDelegatorValidators,
    loadValidators: hoisted.loadValidators
  },
  Utils: {
    getRandomInt: (_min: number, _max: number) => 0
  }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

// Mock web-components — preserve ToastType enum-like values used in code
vi.mock("web-components", () => ({
  Label: {
    name: "Label",
    props: ["value", "variant", "tooltip"],
    template: '<span class="mock-label">{{ value }}</span>'
  },
  Tooltip: { name: "Tooltip", props: ["position", "content"], template: "<span><slot /></span>" },
  SvgIcon: {
    name: "SvgIcon",
    props: ["name"],
    emits: ["click"],
    template: '<i data-test="svg-icon" @click="$emit(\'click\', $event)"></i>'
  },
  ToastType: { success: "success", error: "error" }
}));

import { mount } from "@vue/test-utils";
import RedelegateButton from "./RedelegateButton.vue";

function factory(props: { src?: string; amount?: string } = {}) {
  return mount(RedelegateButton, {
    props: {
      src: props.src ?? "nolusvaloperSRC",
      amount: props.amount ?? "1000000"
    },
    global: {
      mocks: {
        $t: (key: string) => key
      }
    }
  });
}

describe("RedelegateButton.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = {
      simulateRedelegateTx: hoisted.simulateRedelegateTx,
      broadcastTx: hoisted.broadcastTx
    };
    hoisted.simulateRedelegateTx.mockResolvedValue({ txBytes: new Uint8Array([1, 2, 3]) });
    hoisted.broadcastTx.mockResolvedValue({});
    hoisted.fetchPositions.mockResolvedValue(undefined);
    hoisted.fetchBalances.mockResolvedValue(undefined);
    hoisted.loadActivities.mockReturnValue(undefined);
    hoisted.loadDelegatorValidators.mockResolvedValue([]);
    hoisted.loadValidators.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing", () => {
    const wrapper = factory();
    expect(wrapper.exists()).toBe(true);
    wrapper.unmount();
  });

  it("always shows the jailed label (static, key message constant)", () => {
    const wrapper = factory();
    const label = wrapper.find(".mock-label");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe("message.jailed");
    wrapper.unmount();
  });

  it("renders a clickable refresh SvgIcon", () => {
    const wrapper = factory();
    const icon = wrapper.find('[data-test="svg-icon"]');
    expect(icon.exists()).toBe(true);
    wrapper.unmount();
  });

  it("does nothing when wallet is null", async () => {
    hoisted.walletRef.value = null;
    const wrapper = factory();
    await wrapper.find('[data-test="svg-icon"]').trigger("click");
    expect(hoisted.simulateRedelegateTx).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("redelegates evenly when delegator validators are available", async () => {
    hoisted.loadDelegatorValidators.mockResolvedValue([
      { operator_address: "nolusvaloperA", commission: { commission_rates: { rate: "0.05" } }, jailed: false },
      { operator_address: "nolusvaloperB", commission: { commission_rates: { rate: "0.02" } }, jailed: false }
    ]);

    const wrapper = factory({ amount: "1000" });
    await wrapper.find('[data-test="svg-icon"]').trigger("click");
    // allow async chain to settle
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(hoisted.simulateRedelegateTx).toHaveBeenCalledTimes(1);
    const delegations = hoisted.simulateRedelegateTx.mock.calls[0][0];
    // Split 1000 between 2 validators -> 500 each; dest set to loaded validators,
    // src matches prop. Higher-commission validator sorted first and gets remainder (0 here).
    expect(delegations).toHaveLength(2);
    expect(delegations.every((d: { srcValidator: string }) => d.srcValidator === "nolusvaloperSRC")).toBe(true);
    const totals = delegations.reduce(
      (acc: bigint, d: { amount: { amount: string } }) => acc + BigInt(d.amount.amount),
      0n
    );
    expect(totals).toBe(1000n);
    expect(hoisted.broadcastTx).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("skips broadcast and refreshes nothing if there are no valid delegations", async () => {
    // delegator validators returns empty; loadValidators also empty → no amounts
    hoisted.loadDelegatorValidators.mockResolvedValue([]);
    hoisted.loadValidators.mockResolvedValue([]);

    const wrapper = factory({ amount: "1000" });
    await wrapper.find('[data-test="svg-icon"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(hoisted.simulateRedelegateTx).not.toHaveBeenCalled();
    expect(hoisted.broadcastTx).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("ignores concurrent clicks while already loading (per CLAUDE.md: Cosmos forbids concurrent redelegation)", async () => {
    hoisted.loadDelegatorValidators.mockResolvedValue([
      { operator_address: "nolusvaloperA", commission: { commission_rates: { rate: "0.05" } }, jailed: false }
    ]);
    // Force the first simulateRedelegateTx to hang so loading stays true
    let resolveSim!: (v: unknown) => void;
    hoisted.simulateRedelegateTx.mockImplementationOnce(
      () => new Promise((res) => (resolveSim = res as (v: unknown) => void))
    );

    const wrapper = factory({ amount: "1000" });
    const icon = wrapper.find('[data-test="svg-icon"]');

    // fire first click
    await icon.trigger("click");
    // fire second click while loading — should be ignored
    await icon.trigger("click");
    await new Promise((r) => setTimeout(r, 0));

    expect(hoisted.simulateRedelegateTx).toHaveBeenCalledTimes(1);

    // resolve first
    resolveSim({ txBytes: new Uint8Array([1]) });
    await new Promise((r) => setTimeout(r, 0));
    wrapper.unmount();
  });

  it("logs and swallows errors without throwing", async () => {
    hoisted.loadDelegatorValidators.mockResolvedValue([
      { operator_address: "nolusvaloperA", commission: { commission_rates: { rate: "0.05" } }, jailed: false }
    ]);
    hoisted.simulateRedelegateTx.mockRejectedValue(new Error("concurrent redelegation in progress"));

    const wrapper = factory({ amount: "1000" });
    await wrapper.find('[data-test="svg-icon"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(hoisted.loggerError).toHaveBeenCalled();
    // never broadcast or reload state after failure
    expect(hoisted.broadcastTx).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
