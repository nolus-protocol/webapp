/**
 * v10 lease states — issue #288.
 *
 * SingleLease.vue owns two status surfaces that must learn `open_failed`:
 *   - `openingSubState` — the ProgressDots step ladder. The upstream stage RENAME
 *     (open_ica_account → open_lease) means BOTH must map to step 1; transfer_out
 *     and buy_asset stay at step 2.
 *   - the terminal panel — an `open_failed` lease must render a failure/refund
 *     panel with the chain reason, NOT the eternal "opening" skeleton, and must
 *     not redirect away.
 *
 * There is no pre-existing SingleLease test; this is the new file for it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as VueRouter from "vue-router";
import type { LeaseInfo } from "@/common/api";

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
  const state: { lease: unknown } = { lease: null };
  const store = {
    getLease: vi.fn(() => state.lease),
    getLeaseDisplayData: vi.fn(() => ({ inProgressType: null })),
    fetchLeases: vi.fn(async () => {}),
    fetchLeaseDetails: vi.fn(async () => null),
    refresh: vi.fn(async () => {})
  };
  return { state, store };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof VueRouter>("vue-router");
  return {
    ...actual,
    useRoute: () => ({ params: { id: "nolus1lease" } }),
    useRouter: () => ({ replace: vi.fn() })
  };
});

vi.mock("@/router", () => ({ RouteNames: { LEASES: "leases" } }));

// Large poll interval so the onMounted setInterval never fires during a test.
vi.mock("@/config/global", () => ({ UPDATE_LEASES: 10_000_000 }));

vi.mock("@/common/utils", () => ({
  IntercomService: { askQuestion: vi.fn() },
  Logger: { error: vi.fn() }
}));

vi.mock("@/common/stores/leases", () => ({
  useLeasesStore: () => hoisted.store
}));

vi.mock("@/common/stores/balances", () => ({
  useBalancesStore: () => ({ fetchBalances: vi.fn() })
}));

// web-components: Alert renders its title + default/content slots so any reason
// text the terminal panel emits (slot or title) shows up in wrapper.text().
vi.mock("web-components", () => ({
  Alert: {
    name: "Alert",
    props: ["title", "type"],
    template: '<div class="alert" :data-type="type">{{ title }}<slot /><slot name="content" /></div>'
  },
  AlertType: { info: "info", warning: "warning", error: "error" }
}));

vi.mock("@/common/components/ProgressDots.vue", () => ({
  default: { name: "ProgressDots", props: ["steps", "activeStep"], template: '<div class="progress-dots" />' }
}));

vi.mock("./single-lease/SingleLeaseHeader.vue", () => ({
  default: { name: "SingleLeaseHeader", template: "<div />" }
}));
vi.mock("./single-lease/PriceWidget.vue", () => ({ default: { name: "PriceWidget", template: "<div />" } }));
vi.mock("./single-lease/PositionSummaryWidget.vue", () => ({
  default: { name: "PositionSummaryWidget", template: "<div />" }
}));
vi.mock("./single-lease/PositionHealthWidget.vue", () => ({
  default: { name: "PositionHealthWidget", template: "<div />" }
}));
vi.mock("./single-lease/LeaseLogWidget.vue", () => ({ default: { name: "LeaseLogWidget", template: "<div />" } }));

import { mount } from "@vue/test-utils";
import SingleLease from "./SingleLease.vue";

const mkLease = (o: Partial<LeaseInfo> & { reason?: string }): LeaseInfo =>
  ({
    address: "nolus1lease",
    protocol: "osmosis-noble",
    status: "opening",
    amount: { ticker: "ATOM", amount: "0" },
    debt: {
      ticker: "USDC",
      principal: "0",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "0",
      due_interest: "0",
      total: "0"
    },
    interest: { loan_rate: 0, margin_rate: 0, annual_rate_percent: 0 },
    ...o
  }) as LeaseInfo;

function factory() {
  return mount(SingleLease, {
    global: { mocks: { $t: (k: string) => k }, stubs: { "router-view": true } }
  });
}

describe("SingleLease — v10 open_failed and opening stages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.state.lease = null;
    hoisted.store.getLease.mockImplementation(() => hoisted.state.lease);
    hoisted.store.getLeaseDisplayData.mockReturnValue({ inProgressType: null });
  });

  it.each<[string, number]>([
    ["open_lease", 1],
    ["open_ica_account", 1],
    ["transfer_out", 2],
    ["buy_asset", 2]
  ])("maps opening stage %s to ProgressDots step %i", (stage, step) => {
    hoisted.state.lease = mkLease({ status: "opening", in_progress: { opening: { stage } } });
    const wrapper = factory();

    const dots = wrapper.findComponent({ name: "ProgressDots" });
    expect(dots.exists()).toBe(true);
    expect(dots.props("activeStep")).toBe(step);
    wrapper.unmount();
  });

  it("renders the terminal failure panel with the reason for an open_failed lease", () => {
    hoisted.state.lease = mkLease({ status: "open_failed" as LeaseInfo["status"], reason: "timeout" });
    const wrapper = factory();

    expect(wrapper.text()).toContain("timeout");
    wrapper.unmount();
  });

  it("does NOT render the opening skeleton/progress ladder for an open_failed lease", () => {
    hoisted.state.lease = mkLease({ status: "open_failed" as LeaseInfo["status"], reason: "timeout" });
    const wrapper = factory();

    expect(wrapper.findComponent({ name: "ProgressDots" }).exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows refund messaging on the open_failed terminal panel", () => {
    hoisted.state.lease = mkLease({ status: "open_failed" as LeaseInfo["status"], reason: "timeout" });
    const wrapper = factory();

    // i18n is mocked as identity, so a refund copy key renders its key text.
    expect(wrapper.text()).toMatch(/refund/i);
    wrapper.unmount();
  });
});
