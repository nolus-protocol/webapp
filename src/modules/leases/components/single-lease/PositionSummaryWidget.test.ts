/**
 * Rounding regressions on PositionSummaryWidget.
 *
 * These assertions pin down the display convention for the "Size" BigNumber:
 *   - stable (USD / USDC) values   → fixed 2 dp via FormattedAmount (`value` path)
 *   - crypto asset values          → adaptive decimals via TokenAmount (`microAmount` path)
 *
 * LONG:  big = crypto (adaptive), sub = stable (2 dp)
 * SHORT: big = stable (2 dp),     sub = crypto (adaptive)
 *
 * The SHORT branch has regressed at least once before (display flipped so the
 * BTC sub-number gets rounded to "0.00 BTC" and the USDC main number shows 8
 * decimals). Keep these tests green to prevent that returning.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  const USDC = {
    key: "USDC_NOBLE@OSMOSIS-OSMOSIS-ALL_BTC",
    name: "USD Coin",
    symbol: "USDC_NOBLE",
    shortName: "USDC",
    ticker: "USDC_NOBLE",
    icon: "",
    decimal_digits: 6,
    ibcData: "ibc/USDC",
    native: false
  };
  const BTC = {
    key: "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC",
    name: "Bitcoin",
    symbol: "ALL_BTC",
    shortName: "BTC",
    ticker: "ALL_BTC",
    icon: "",
    decimal_digits: 8,
    ibcData: "ibc/ALL_BTC",
    native: false
  };

  const configRef = {
    currenciesData: {
      [USDC.key]: USDC,
      [BTC.key]: BTC
    }
  };

  const pricesRef = {
    prices: {
      [USDC.key]: { price: "1" },
      [BTC.key]: { price: "77949.36" }
    }
  };

  return { configRef, pricesRef, USDC, BTC };
});

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof import("vue-router")>("vue-router");
  return { ...actual, useRouter: () => ({ push: vi.fn() }) };
});

vi.mock("@/router", () => ({ RouteNames: { LEASES: "leases" } }));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    get currenciesData() {
      return hoisted.configRef.currenciesData;
    }
  })
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.pricesRef.prices;
    }
  })
}));

vi.mock("@/common/stores/history", () => ({
  useHistoryStore: () => ({ loadActivities: vi.fn() })
}));

vi.mock("@/common/stores/wallet", () => ({
  useWalletStore: () => ({ wallet: null })
}));

vi.mock("@/common/utils", async () => ({
  dateParser: () => "",
  IntercomService: { askQuestion: vi.fn() },
  isMobile: () => false,
  Logger: { error: vi.fn() },
  walletOperation: vi.fn()
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatNumber: (v: string) => v,
  getAdaptivePriceDecimals: () => 2
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getCurrencyByTicker: (ticker: string) => {
    if (ticker === hoisted.USDC.ticker) return hoisted.USDC;
    if (ticker === hoisted.BTC.ticker) return hoisted.BTC;
    return undefined;
  },
  getCurrencyByDenom: (denom: string) => {
    if (denom === hoisted.USDC.ibcData) return hoisted.USDC;
    if (denom === hoisted.BTC.ibcData) return hoisted.BTC;
    return undefined;
  },
  getLpnByProtocol: (protocol: string) => {
    // SHORT protocol (…-ALL_BTC) → LPN is the volatile crypto.
    // LONG  protocol (…-USDC_NOBLE) → LPN is the stable.
    if (protocol.endsWith("-USDC_NOBLE")) return hoisted.USDC;
    return hoisted.BTC;
  }
}));

vi.mock("@nolus/nolusjs", () => ({
  NolusClient: { getInstance: () => ({ getCosmWasmClient: async () => ({}) }) },
  NolusWallet: class {}
}));

vi.mock("@nolus/nolusjs/build/contracts", () => ({
  Lease: class {}
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("web-components", () => ({
  Widget: { name: "Widget", template: "<div><slot /></div>" },
  Button: { name: "Button", props: ["label"], template: "<button />" },
  SvgIcon: { name: "SvgIcon", props: ["name"], template: "<i />" },
  Tooltip: { name: "Tooltip", props: ["content"], template: "<span><slot /></span>" },
  ToastType: { success: "success", error: "error" }
}));

vi.mock("@/common/components/EmptyState.vue", () => ({
  default: { name: "EmptyState", template: "<div />" }
}));

vi.mock("@/common/components/WidgetHeader.vue", () => ({
  default: { name: "WidgetHeader", props: ["label", "icon"], template: "<div />" }
}));

vi.mock("./PnlOverTimeChart.vue", () => ({
  default: { name: "PnlOverTimeChart", props: ["lease"], template: "<div />" }
}));

// Stub BigNumber so we can read the props it's given without pulling in
// animation/layout code. `label` is our key to address specific slots.
vi.mock("@/common/components/BigNumber.vue", () => ({
  default: {
    name: "BigNumber",
    props: ["label", "labelTooltip", "amount", "secondary", "additional", "pnlStatus", "loading", "loadingWidth"],
    template: '<div data-test="bignumber" :data-label="label" />'
  }
}));

import { mount, type VueWrapper } from "@vue/test-utils";
import { Dec } from "@keplr-wallet/unit";
import PositionSummaryWidget from "./PositionSummaryWidget.vue";

interface BigNumberAmount {
  microAmount?: string;
  value?: string;
  denom?: string;
  decimals?: number;
  fontSize?: number;
  animatedReveal?: boolean;
  compact?: boolean;
  isDenomPrefix?: boolean;
  hasSpace?: boolean;
}

function sizeWidget(wrapper: VueWrapper): {
  amount: BigNumberAmount;
  secondary: BigNumberAmount;
} {
  const bn = wrapper.findAllComponents({ name: "BigNumber" }).find((w) => w.props("label") === "message.lease-size");
  if (!bn) throw new Error("Size BigNumber not found");
  return { amount: bn.props("amount") as BigNumberAmount, secondary: bn.props("secondary") as BigNumberAmount };
}

function makeShortLease() {
  // Chain-style raw lease for a SHORT: lease.amount is in the stable (USDC
  // micros, 6 dp). Debt ticker is the volatile.
  return {
    address: "nolus1leaseshort",
    status: "opened",
    protocol: "OSMOSIS-OSMOSIS-ALL_BTC",
    amount: { ticker: hoisted.USDC.ticker, amount: "70000000" }, // 70 USDC
    debt: {
      ticker: hoisted.BTC.ticker,
      principal: "89800",
      amount: "89800",
      total: "89800",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "0",
      due_interest: "0"
    },
    interest: { annual_rate_percent: 5 }
  } as unknown as Parameters<typeof PositionSummaryWidget>[0];
}

function makeLongLease() {
  // LONG: lease.amount is in the volatile crypto (BTC micros, 8 dp). Debt
  // ticker is the stable.
  return {
    address: "nolus1leaselong",
    status: "opened",
    protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE",
    amount: { ticker: hoisted.BTC.ticker, amount: "89800" }, // 0.000898 BTC
    debt: {
      ticker: hoisted.USDC.ticker,
      principal: "70000000",
      amount: "70000000",
      total: "70000000",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "0",
      due_interest: "0"
    },
    interest: { annual_rate_percent: 5 }
  } as unknown as Parameters<typeof PositionSummaryWidget>[0];
}

function factory(lease: unknown, positionType: "long" | "short") {
  return mount(PositionSummaryWidget, {
    props: {
      lease: lease as never,
      displayData: {
        positionType,
        interestDue: new Dec(0),
        totalDebt: new Dec(0),
        interestRate: new Dec(0),
        interestRateMonthly: new Dec(0),
        interestDueWarning: false,
        interestDueDate: null,
        downPayment: new Dec(0),
        openingPrice: new Dec(0),
        fee: new Dec(0),
        repaymentValue: new Dec(0),
        liquidationPrice: new Dec(0),
        health: new Dec(0),
        healthStatus: "healthy",
        pnlAmount: new Dec(0),
        pnlPercent: new Dec(0),
        pnlPositive: true,
        stopLoss: null,
        takeProfit: null,
        inProgressType: null,
        unitAsset: new Dec(0),
        stableAsset: new Dec(0)
      } as never,
      loading: false
    },
    global: {
      mocks: { $t: (k: string) => k },
      provide: { onShowToast: vi.fn(), reload: vi.fn() }
    }
  });
}

describe("PositionSummaryWidget — Size rounding", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe("SHORT position", () => {
    it("renders the big Size number as a rounded USD value (2 dp), NOT adaptive crypto", () => {
      const wrapper = factory(makeShortLease(), "short");
      const { amount } = sizeWidget(wrapper);

      // Stable 2-dp path: FormattedAmount (value-based) with $ prefix.
      expect(amount.value).toBe("70.00");
      expect(amount.denom).toBe("$");
      expect(amount.decimals).toBe(2);
      // Must NOT be a TokenAmount / microAmount render — that's what produced
      // the "0.69979522 USDC" regression (USDC micros divided by 10^8).
      expect(amount.microAmount).toBeUndefined();
      wrapper.unmount();
    });

    it("renders the sub Size number as adaptive crypto (BTC), NOT rounded 2 dp", () => {
      const wrapper = factory(makeShortLease(), "short");
      const { secondary } = sizeWidget(wrapper);

      // Adaptive-crypto path: TokenAmount (microAmount-based) with the
      // volatile's decimals so `0.000898 BTC` shows real precision instead
      // of being truncated to "0.00 BTC" (the regression).
      expect(secondary.microAmount).toBe("89801"); // 70 / 77949.36 * 1e8, truncated
      expect(secondary.decimals).toBe(hoisted.BTC.decimal_digits);
      expect(secondary.denom).toBe(hoisted.BTC.shortName);
      expect(secondary.value).toBeUndefined();
      wrapper.unmount();
    });

    it("falls back to zero crypto sub-number without crashing when the price feed is missing", () => {
      const saved = hoisted.pricesRef.prices;
      hoisted.pricesRef.prices = {} as typeof saved;
      try {
        const wrapper = factory(makeShortLease(), "short");
        const { secondary } = sizeWidget(wrapper);
        expect(secondary.value).toBe("0");
        expect(secondary.microAmount).toBeUndefined();
        wrapper.unmount();
      } finally {
        hoisted.pricesRef.prices = saved;
      }
    });
  });

  describe("LONG position", () => {
    it("renders the big Size number as adaptive crypto (BTC)", () => {
      const wrapper = factory(makeLongLease(), "long");
      const { amount } = sizeWidget(wrapper);

      expect(amount.microAmount).toBe("89800");
      expect(amount.decimals).toBe(hoisted.BTC.decimal_digits);
      expect(amount.denom).toBe(hoisted.BTC.shortName);
      expect(amount.value).toBeUndefined();
      wrapper.unmount();
    });

    it("renders the sub Size number as rounded USD (2 dp)", () => {
      const wrapper = factory(makeLongLease(), "long");
      const { secondary } = sizeWidget(wrapper);

      // 0.000898 BTC * 77949.36 = $69.99 (stable 2dp)
      expect(secondary.denom).toBe("$");
      expect(secondary.value).toBeDefined();
      expect(secondary.value).toMatch(/^\d+\.\d{2}$/);
      expect(secondary.microAmount).toBeUndefined();
      wrapper.unmount();
    });
  });

  describe("Interest Due (both positions)", () => {
    it("SHORT: renders interest in the crypto LPN decimals (adaptive)", () => {
      const wrapper = factory(makeShortLease(), "short");
      const bn = wrapper
        .findAllComponents({ name: "BigNumber" })
        .find((w) => w.props("label") === "message.interest-due");
      expect(bn).toBeTruthy();
      const amount = bn!.props("amount") as BigNumberAmount;
      // Must go through the microAmount path with the volatile's decimals so
      // TokenAmount's adaptive renderer can show sat-level amounts. Passing
      // `decimals: 2` here would cut off crypto precision.
      expect(amount.decimals).toBe(hoisted.BTC.decimal_digits);
      expect(amount.denom).toBe(hoisted.BTC.shortName);
      expect(amount.microAmount).toBeDefined();
      wrapper.unmount();
    });

    it("LONG: renders interest in the stable LPN decimals", () => {
      const wrapper = factory(makeLongLease(), "long");
      const bn = wrapper
        .findAllComponents({ name: "BigNumber" })
        .find((w) => w.props("label") === "message.interest-due");
      expect(bn).toBeTruthy();
      const amount = bn!.props("amount") as BigNumberAmount;
      expect(amount.decimals).toBe(hoisted.USDC.decimal_digits);
      expect(amount.denom).toBe(hoisted.USDC.shortName);
      expect(amount.microAmount).toBeDefined();
      wrapper.unmount();
    });
  });
});
