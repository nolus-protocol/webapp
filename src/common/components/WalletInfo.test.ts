import { describe, it, expect, beforeEach, vi } from "vitest";

// WalletInfo pulls in the wallet store, web-components, and the utils barrel.
// Only the connected-address rendering is under test, so every non-render
// dependency is stubbed at its module boundary. WalletConnectMechanism is
// mocked with the real string values so the mechanism dispatch stays faithful.
const hoisted = vi.hoisted(() => ({
  mechanism: "sol_phantom" as string | null,
  store: { wallet: { address: "nolus1self" } as { address: string } | null, solAddress: "" as string | undefined },
  copyToClipboard: vi.fn()
}));

vi.mock("web-components", () => ({
  Button: {
    name: "Button",
    inheritAttrs: false,
    emits: ["click"],
    template: `<button v-bind="$attrs" @click="$emit('click')"><slot /></button>`
  },
  Popover: {
    name: "Popover",
    inheritAttrs: false,
    template: `<div><slot name="content" /></div>`
  },
  ToastType: { success: "success" }
}));

vi.mock("@/common/utils", () => ({
  isMobile: () => false,
  TextFormat: {
    truncateString: (s: string) => s,
    copyToClipboard: hoisted.copyToClipboard
  },
  WalletStorage: { getWalletConnectMechanism: () => hoisted.mechanism }
}));

vi.mock("@/config/global", () => ({
  NATIVE_NETWORK: { label: "Nolus" }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => hoisted.store
}));

vi.mock("@/common/types", () => ({
  WalletConnectMechanism: {
    KEPLR: "extension",
    LEDGER: "ledger",
    LEDGER_BLUETOOTH: "ledger_bluetooth",
    SOL_PHANTOM: "sol_phantom",
    SOL_SOLFLARE: "sol_solflare"
  }
}));

import { mount } from "@vue/test-utils";
import WalletInfo from "./WalletInfo.vue";

const SOL_ADDRESS = "4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw";

function factory() {
  return mount(WalletInfo, {
    global: { mocks: { $t: (k: string) => k }, provide: { onShowToast: vi.fn() } }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mechanism = "sol_phantom";
  hoisted.store = { wallet: { address: "nolus1self" }, solAddress: SOL_ADDRESS };
});

describe("WalletInfo.vue — Solana address row", () => {
  it("renders the base58 solAddress row for a Solana mechanism", () => {
    hoisted.mechanism = "sol_phantom";
    const wrapper = factory();
    const row = wrapper.find('[data-test="sol-address"]');
    expect(row.exists()).toBe(true);
    expect(row.text()).toBe(SOL_ADDRESS);
    wrapper.unmount();
  });

  it("does not render the solAddress row for a Keplr (cosmos) mechanism", () => {
    hoisted.mechanism = "extension";
    const wrapper = factory();
    expect(wrapper.find('[data-test="sol-address"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("copy control carries the base58 solAddress", async () => {
    hoisted.mechanism = "sol_phantom";
    const wrapper = factory();
    await wrapper.find('[data-test="copy-sol-address"]').trigger("click");
    expect(hoisted.copyToClipboard).toHaveBeenCalledWith(SOL_ADDRESS);
    wrapper.unmount();
  });
});
