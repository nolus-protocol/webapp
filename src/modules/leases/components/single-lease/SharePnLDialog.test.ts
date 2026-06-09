import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const hoisted = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  getPositionTypeMock: vi.fn(() => "Long"),
  pricesState: {} as Record<string, { price: string }>,
  currenciesData: {} as Record<string, unknown>
}));

vi.mock("@/common/utils", () => ({
  Logger: { error: hoisted.loggerErrorMock }
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => String(v)
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getCurrencyByTicker: (ticker: string) => ({ ibcData: `ibc/${ticker}`, shortName: ticker }),
  getCurrencyByDenom: (denom: string) => ({ shortName: denom.replace("ibc/", "") })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    getPositionType: hoisted.getPositionTypeMock,
    get currenciesData() {
      return hoisted.currenciesData;
    }
  })
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.pricesState;
    }
  })
}));

vi.mock("@/config/global", () => ({
  NATIVE_CURRENCY: { maximumFractionDigits: 4 }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: { value: "en" } })
}));

// Asset URL imports resolve to plain strings under test.
vi.mock("@/assets/icons/share-image-2.png?url", () => ({ default: "img2" }));
vi.mock("@/assets/icons/share-image-3.png?url", () => ({ default: "img3" }));
vi.mock("@/assets/icons/share-image-4.png?url", () => ({ default: "img4" }));
vi.mock("@/assets/icons/logo-light.svg?url", () => ({ default: "logo" }));

vi.mock("web-components", () => ({
  Dialog: {
    name: "Dialog",
    props: ["title", "showClose", "classList"],
    methods: {
      show() {}
    },
    template: "<div data-test='dialog'><slot name='content' /></div>"
  },
  Button: {
    name: "Button",
    props: ["size", "severity", "label"],
    emits: ["click"],
    template: '<button data-test="btn" @click="$emit(\'click\')">{{ label }}</button>'
  },
  Checkbox: {
    name: "Checkbox",
    props: ["id", "label", "modelValue"],
    emits: ["update:modelValue", "input"],
    template: `<input
      type="checkbox"
      :data-cbid="id"
      :checked="modelValue"
      @change="$emit('update:modelValue', !modelValue)"
    />`
  }
}));

import { mount, flushPromises } from "@vue/test-utils";
import SharePnLDialog from "./SharePnLDialog.vue";

const LEASE_INFO = {
  status: "opened",
  protocol: "OSMOSIS-OSMOSIS-ALL_BTC",
  amount: { ticker: "ALL_BTC", amount: "1000000" },
  debt: { ticker: "ALL_BTC" },
  etl_data: { lease_position_ticker: "ALL_BTC" }
};

const DISPLAY_DATA = {
  openingPrice: { toString: () => "60000" },
  assetValueUsd: { toString: () => "1000" },
  pnlPercent: { toString: (_d?: number) => "12.34" },
  pnlAmount: {
    isNegative: () => false,
    abs: () => ({ toString: () => "123.45" })
  },
  leverageAtOpen: { isPositive: () => true, toString: () => "2.5" },
  downPayment: { isPositive: () => true, add: () => ({ quo: () => ({ toString: () => "2" }) }) },
  totalDebtUsd: {}
};

function factory() {
  return mount(SharePnLDialog, {
    global: { mocks: { $t: (k: string) => k } }
  });
}

describe("SharePnLDialog.vue — characterization (pre-composable extraction)", () => {
  let toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL");

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.getPositionTypeMock.mockReturnValue("Long");
    hoisted.pricesState = { "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC": { price: "60000" } };
    hoisted.currenciesData = {};
    // jsdom canvas has no real 2d context / toDataURL — stub the bits the
    // component touches so render attempts and download() don't throw.
    toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,xxx");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the dialog with three cover options and three info checkboxes", async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find("[data-test='dialog']").exists()).toBe(true);
    // 3 cover buttons (each wraps a canvas) + the 2 action buttons are separate.
    expect(wrapper.findAll("button.rounded").length).toBe(3);
    expect(wrapper.findAll("input[type='checkbox']").length).toBe(3);
    wrapper.unmount();
  });

  it("defaults all three optional-info checkboxes to checked", async () => {
    const wrapper = factory();
    await flushPromises();
    const boxes = wrapper.findAll("input[type='checkbox']");
    for (const box of boxes) {
      expect((box.element as HTMLInputElement).checked).toBe(true);
    }
    wrapper.unmount();
  });

  it("marks the chosen cover as selected when clicked", async () => {
    const wrapper = factory();
    await flushPromises();
    const covers = wrapper.findAll("button.rounded");
    expect(covers[0]?.classes()).toContain("selected");

    await covers[2]?.trigger("click");
    await flushPromises();

    expect(covers[2]?.classes()).toContain("selected");
    expect(covers[0]?.classes()).not.toContain("selected");
    wrapper.unmount();
  });

  it("shows the Share button only when navigator.share is available", async () => {
    const original = (navigator as unknown as { share?: unknown }).share;

    (navigator as unknown as { share?: unknown }).share = undefined;
    const noShare = factory();
    await flushPromises();
    expect(noShare.findAll("[data-test='btn']").map((b) => b.text())).not.toContain("message.share");
    noShare.unmount();

    (navigator as unknown as { share?: unknown }).share = vi.fn();
    const withShare = factory();
    await flushPromises();
    expect(withShare.findAll("[data-test='btn']").map((b) => b.text())).toContain("message.share");
    withShare.unmount();

    (navigator as unknown as { share?: unknown }).share = original;
  });

  it("download() reads the canvas as a PNG and triggers an anchor download", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const wrapper = factory();
    await flushPromises();

    const downloadBtn = wrapper.findAll("[data-test='btn']").find((b) => b.text() === "message.download-png");
    expect(downloadBtn).toBeTruthy();
    await downloadBtn?.trigger("click");
    await flushPromises();

    expect(toDataURLSpy).toHaveBeenCalledWith("image/png");
    expect(clickSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("exposes show(leaseData, displayData) and runs it without throwing", async () => {
    const wrapper = factory();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      show: (d: unknown, dd?: unknown) => Promise<void>;
    };
    expect(typeof vm.show).toBe("function");
    await expect(vm.show(LEASE_INFO, DISPLAY_DATA)).resolves.toBeUndefined();
    await flushPromises();
    wrapper.unmount();
  });
});
