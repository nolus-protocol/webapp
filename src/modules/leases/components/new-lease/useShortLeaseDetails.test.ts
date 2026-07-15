/**
 * Direct unit tests for the useShortLeaseDetails composable, which had no
 * direct coverage (ShortForm.test.ts stubs ShortLeaseDetails.vue to a <div/>).
 * Pins the behaviors the extraction made fragile: the 600 ms setSwapFee
 * debounce that keeps rapid quote changes under the backend's 2 RPS
 * /api/swap/route limit, the two Skip route legs both settling into the
 * position's stable ticker (a source->source route is a no-op that returns a
 * zero fee), the
 * calculateLiquidationShort(stableAsset, unitAsset) argument order (a swap is
 * an inverse-liquidation bug), and a single timer teardown on unmount.
 * Mocked at the boundary: stores, SkipRouter, LeaseMath, CurrencyUtils.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, reactive } from "vue";
import { Dec } from "@keplr-wallet/unit";

const hoisted = vi.hoisted(() => ({
  getRoute: vi.fn(),
  calculateLiquidationShort: vi.fn(),
  currenciesData: {} as Record<string, unknown>,
  prices: {} as Record<string, { price: string }>
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.prices;
    }
  })
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    get currenciesData() {
      return hoisted.currenciesData;
    }
  })
}));

vi.mock("@/common/utils", () => ({
  LeaseMath: {
    calculateLiquidationShort: hoisted.calculateLiquidationShort
  }
}));

vi.mock("@/common/utils/CurrencyLookup", () => ({
  getCurrencyByTicker: (ticker: string) => ({
    key: `${ticker}@osmosis-1`,
    ticker,
    decimal_digits: ticker === "ALL_BTC" ? 8 : 6,
    ibcData: `ibc/${ticker}`
  }),
  getLpnByProtocol: () => ({ key: "USDC@osmosis-1", ibcData: "ibc/LPN", decimal_digits: 6 })
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  getAdaptivePriceDecimals: () => 2,
  formatPrice: (v: string) => v
}));

vi.mock("@/common/utils/SkipRoute", () => ({
  SkipRouter: { getRoute: hoisted.getRoute }
}));

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertDenomToMinimalDenom: () => ({ amount: "1000000" })
  }
}));

import { useShortLeaseDetails, type ShortLeaseDetailsProps } from "./useShortLeaseDetails";

type ShortApi = ReturnType<typeof useShortLeaseDetails>;

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    total: { ticker: "USDC_NOBLE", amount: "2000000000" },
    borrow: { ticker: "ALL_BTC", amount: "500000000" },
    annual_interest_rate: 0,
    annual_interest_rate_margin: 0,
    ...overrides
  };
}

function setup(lease: ShortLeaseDetailsProps["lease"] = null) {
  const state = reactive<ShortLeaseDetailsProps>({
    lease,
    loanCurrency: "ALL_BTC@osmosis-1",
    downpaymenAmount: "10",
    downpaymentCurrency: "ATOM@osmosis-1"
  });
  let api!: ShortApi;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useShortLeaseDetails(state);
        return () => null;
      }
    })
  );
  return { api, wrapper, state };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getRoute.mockResolvedValue({ usd_amount_in: "1", usd_amount_out: "1", swap_price_impact_percent: "0" });
  hoisted.calculateLiquidationShort.mockReturnValue(new Dec("1234"));
  hoisted.currenciesData = {
    "ALL_BTC@osmosis-1": { key: "ALL_BTC@osmosis-1", ibcData: "ibc/BTC", decimal_digits: 8 },
    "ATOM@osmosis-1": { key: "ATOM@osmosis-1", ibcData: "ibc/ATOM", decimal_digits: 6 },
    "USDC_NOBLE@osmosis-1": { key: "USDC_NOBLE@osmosis-1", ibcData: "ibc/USDCN", decimal_digits: 6 }
  };
  hoisted.prices = {
    "ALL_BTC@osmosis-1": { price: "100000" },
    "ATOM@osmosis-1": { price: "10" },
    "USDC@osmosis-1": { price: "1" }
  };
});

describe("useShortLeaseDetails — setSwapFee 600 ms debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collapses three rapid lease changes into a single Skip fire (two legs) after 600 ms", async () => {
    const { wrapper, state } = setup(null);

    // Three distinct lease references inside the window, each re-arming the timer.
    state.lease = makeLease({ borrow: { ticker: "ALL_BTC", amount: "1" } });
    await nextTick();
    state.lease = makeLease({ borrow: { ticker: "ALL_BTC", amount: "2" } });
    await nextTick();
    state.lease = makeLease({ borrow: { ticker: "ALL_BTC", amount: "3" } });
    await nextTick();

    expect(hoisted.getRoute, "no fire before the debounce window elapses").not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);

    expect(
      hoisted.getRoute,
      "the collapsed fire issues exactly the two route legs, not three x two"
    ).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("does not fire before the 600 ms floor is reached", async () => {
    const { wrapper, state } = setup(null);
    state.lease = makeLease();
    await nextTick();

    await vi.advanceTimersByTimeAsync(599);
    expect(hoisted.getRoute, "the fee call waits for the full 600 ms floor").not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(hoisted.getRoute, "the fee call fires once the floor is crossed").toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});

describe("useShortLeaseDetails — Skip route legs target the stable ticker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("routes both the down payment and the borrowed LPN into the position stable (lease.total.ticker)", async () => {
    const { wrapper, state } = setup(null);
    state.lease = makeLease();
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);

    expect(hoisted.getRoute).toHaveBeenCalledTimes(2);
    const downPaymentLeg = hoisted.getRoute.mock.calls[0];
    const borrowLeg = hoisted.getRoute.mock.calls[1];
    if (downPaymentLeg === undefined || borrowLeg === undefined) {
      throw new Error("expected both Skip route legs to have fired");
    }

    expect(downPaymentLeg[0], "down payment leg starts from the down payment currency").toBe("ibc/ATOM");
    expect(downPaymentLeg[1], "down payment leg settles into the stable, not itself").toBe("ibc/USDCN");
    expect(borrowLeg[0], "borrow leg starts from the borrowed LPN").toBe("ibc/LPN");
    expect(borrowLeg[1], "borrow leg settles into the stable, not the shorted asset").toBe("ibc/USDCN");
    wrapper.unmount();
  });
});

describe("useShortLeaseDetails — liquidation argument order", () => {
  it("passes stableAsset (from total) then unitAsset (from borrow) to calculateLiquidationShort", () => {
    const { api, wrapper } = setup(makeLease());

    // Reading calculateLique drives getLquidation -> calculateLiquidationShort.
    void api.calculateLique.value;

    expect(hoisted.calculateLiquidationShort).toHaveBeenCalledTimes(1);
    const call = hoisted.calculateLiquidationShort.mock.calls[0];
    if (call === undefined) throw new Error("expected calculateLiquidationShort to have been called");
    const [stableAsset, unitAsset] = call;
    // total 2_000_000_000 at 6 dp = 2000; borrow 500_000_000 at 8 dp = 5.
    expect(Number(stableAsset.toString()), "first arg is the stable total (2000), not the unit").toBe(2000);
    expect(Number(unitAsset.toString()), "second arg is the borrowed unit (5), not the stable").toBe(5);
    wrapper.unmount();
  });
});

describe("useShortLeaseDetails — teardown on unmount", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("clears exactly one pending debounce timer when the instance unmounts", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { wrapper } = setup(makeLease());

    const before = clearSpy.mock.calls.length;
    wrapper.unmount();

    expect(clearSpy.mock.calls.length - before, "onUnmounted clears the timer exactly once for this instance").toBe(1);
  });

  it("cancels a pending Skip fire so an unmounted instance never hits the backend", async () => {
    const { wrapper, state } = setup(null);
    state.lease = makeLease();
    await nextTick(); // arms the 600 ms timer

    wrapper.unmount(); // must clear it

    await vi.advanceTimersByTimeAsync(600);
    expect(hoisted.getRoute, "the cancelled timer issues no route call after unmount").not.toHaveBeenCalled();
  });
});
