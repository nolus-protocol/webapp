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
  const simulateTx = vi.fn();
  const broadcastTx = vi.fn();
  const loadActivities = vi.fn();
  const walletOperationMock = vi.fn(async (op: () => Promise<void> | void) => {
    await op();
  });
  const loggerError = vi.fn();
  const onShowToast = vi.fn();

  const walletRef: {
    value: { simulateTx: typeof simulateTx; broadcastTx: typeof broadcastTx; address: string } | null;
  } = {
    value: { simulateTx, broadcastTx, address: "nolus1abc" }
  };
  const stakingRef: { totalStaked: string } = { totalStaked: "1000000" };

  return {
    simulateTx,
    broadcastTx,
    loadActivities,
    walletOperationMock,
    loggerError,
    onShowToast,
    walletRef,
    stakingRef
  };
});

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({
    get wallet() {
      return hoisted.walletRef.value;
    }
  })
}));

vi.mock("@/common/stores/staking", () => ({
  useStakingStore: () => ({
    get totalStaked() {
      return hoisted.stakingRef.totalStaked;
    }
  })
}));

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: hoisted.loadActivities })
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: hoisted.loggerError },
  formatDateTime: (d: string) => d,
  walletOperation: hoisted.walletOperationMock
}));

vi.mock("@/common/utils/sanitize", () => ({
  parseMarkdownSafe: (s: string) => `<p>${s}</p>`
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("web-components", () => ({
  Dialog: {
    name: "Dialog",
    props: ["title", "showClose", "disableClose"],
    template: `
      <div data-test="dialog">
        <div data-test="title">{{ title }}</div>
        <slot name="content" />
        <slot name="footer" />
      </div>
    `,
    methods: {
      show() {
        /* no-op */
      },
      close() {
        /* no-op */
      }
    }
  },
  Button: {
    name: "Button",
    props: ["label", "icon", "iconPosition", "severity", "size", "disabled", "loading"],
    emits: ["click"],
    template:
      '<button :data-test="label" :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}</button>'
  },
  ProposalStatus: {
    PROPOSAL_STATUS_UNSPECIFIED: "PROPOSAL_STATUS_UNSPECIFIED",
    PROPOSAL_STATUS_DEPOSIT_PERIOD: "PROPOSAL_STATUS_DEPOSIT_PERIOD",
    PROPOSAL_STATUS_VOTING_PERIOD: "PROPOSAL_STATUS_VOTING_PERIOD",
    PROPOSAL_STATUS_PASSED: "PROPOSAL_STATUS_PASSED",
    PROPOSAL_STATUS_REJECTED: "PROPOSAL_STATUS_REJECTED",
    PROPOSAL_STATUS_FAILED: "PROPOSAL_STATUS_FAILED"
  },
  ToastType: { success: "success", error: "error" }
}));

// VotingLine is a child we do not care about for smoke tests — stub it.
vi.mock("./VotingLine.vue", () => ({
  default: { name: "VotingLine", props: ["voting", "labels"], template: "<div />" }
}));

import { mount } from "@vue/test-utils";
import { Dec } from "@keplr-wallet/unit";
import VoteDialog from "./VoteDialog.vue";

function makeProposal(status = "PROPOSAL_STATUS_VOTING_PERIOD") {
  return {
    id: "42",
    title: "Test Proposal",
    summary: "Do the thing",
    status,
    tally: {
      yes_count: "0",
      abstain_count: "0",
      no_count: "0",
      no_with_veto_count: "0"
    },
    voting_end_time: "2030-01-01T00:00:00Z"
  };
}

function factory(overrides: { proposal?: ReturnType<typeof makeProposal> } = {}) {
  return mount(VoteDialog, {
    props: {
      proposal: overrides.proposal ?? makeProposal(),
      bondedTokens: new Dec("1000000"),
      quorumTokens: new Dec("0.334")
    },
    global: {
      mocks: { $t: (k: string) => k },
      provide: { onShowToast: hoisted.onShowToast }
    }
  });
}

describe("VoteDialog.vue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setActivePinia(createPinia());
    hoisted.walletRef.value = {
      simulateTx: hoisted.simulateTx,
      broadcastTx: hoisted.broadcastTx,
      address: "nolus1abc"
    };
    hoisted.stakingRef.totalStaked = "1000000";
    hoisted.simulateTx.mockResolvedValue({ txBytes: new Uint8Array([1]) });
    hoisted.broadcastTx.mockResolvedValue({});
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

  it("renders the proposal id and title in the dialog title", () => {
    const wrapper = factory();
    expect(wrapper.find('[data-test="title"]').text()).toContain("42");
    expect(wrapper.find('[data-test="title"]').text()).toContain("Test Proposal");
    wrapper.unmount();
  });

  it("renders all four vote buttons when voting period is active and user has delegations", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="message.yes"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="message.no"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="message.abstained"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="message.veto"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("hides vote buttons when user has no delegated tokens", async () => {
    hoisted.stakingRef.totalStaked = "0";
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="message.yes"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("hides vote buttons when the proposal is not in the voting period", async () => {
    const wrapper = factory({ proposal: makeProposal("PROPOSAL_STATUS_PASSED") });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="message.yes"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("clicking Yes dispatches a vote transaction via the wallet", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="message.yes"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(hoisted.walletOperationMock).toHaveBeenCalledTimes(1);
    expect(hoisted.simulateTx).toHaveBeenCalledTimes(1);
    expect(hoisted.broadcastTx).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("invokes history reload and success toast after a successful vote", async () => {
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="message.no"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(hoisted.loadActivities).toHaveBeenCalled();
    expect(hoisted.onShowToast).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("logs errors and does not throw when broadcastTx fails", async () => {
    hoisted.broadcastTx.mockRejectedValue(new Error("rejected"));
    const wrapper = factory();
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="message.veto"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(hoisted.loggerError).toHaveBeenCalled();
    wrapper.unmount();
  });
});
