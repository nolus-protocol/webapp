/**
 * Direct unit tests for the useLongLeaseDetails composable — the Long-position
 * mirror of useShortLeaseDetails.test.ts, pinning the strategy residue the
 * shared core wires per position: the calculateLiquidation(unitAsset,
 * stableAsset) argument order (inverted versus Short — a swap is the same
 * inverse-liquidation bug class), the Skip route target being the leased asset
 * itself (not the stable), the negative percentLique sign, the 600 ms debounce
 * floor, and per-instance timer teardown (two mounted instances own
 * independent timers). Mocked at the boundary: stores, SkipRouter, LeaseMath,
 * CurrencyUtils.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, reactive } from "vue";
import { Dec } from "@keplr-wallet/unit";

const hoisted = vi.hoisted(() => ({
  getRoute: vi.fn(),
  calculateLiquidation: vi.fn(),
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
    calculateLiquidation: hoisted.calculateLiquidation
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

import { useLongLeaseDetails } from "./useLongLeaseDetails";
import type { LeaseDetailsProps } from "./useLeaseDetailsCore";

type LongApi = ReturnType<typeof useLongLeaseDetails>;

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    total: { ticker: "USDC_NOBLE", amount: "2000000000" },
    borrow: { ticker: "ALL_BTC", amount: "500000000" },
    annual_interest_rate: 0,
    annual_interest_rate_margin: 0,
    ...overrides
  };
}

function setup(lease: LeaseDetailsProps["lease"] = null) {
  const state = reactive<LeaseDetailsProps>({
    lease,
    loanCurrency: "ALL_BTC@osmosis-1",
    downpaymenAmount: "10",
    downpaymentCurrency: "ATOM@osmosis-1"
  });
  let api!: LongApi;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useLongLeaseDetails(state);
        return () => null;
      }
    })
  );
  return { api, wrapper, state };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getRoute.mockResolvedValue({ usd_amount_in: "1", usd_amount_out: "1", swap_price_impact_percent: "0" });
  hoisted.calculateLiquidation.mockReturnValue(new Dec("1234"));
  hoisted.currenciesData = {
    "ALL_BTC@osmosis-1": { key: "ALL_BTC@osmosis-1", ibcData: "ibc/BTC", decimal_digits: 6 },
    "ATOM@osmosis-1": { key: "ATOM@osmosis-1", ibcData: "ibc/ATOM", decimal_digits: 6 },
    "USDC_NOBLE@osmosis-1": { key: "USDC_NOBLE@osmosis-1", ibcData: "ibc/USDCN", decimal_digits: 6 }
  };
  hoisted.prices = {
    "ALL_BTC@osmosis-1": { price: "2000000" },
    "ATOM@osmosis-1": { price: "10" },
    "USDC@osmosis-1": { price: "1" }
  };
});

describe("useLongLeaseDetails — setSwapFee 600 ms debounce (shared core, Long instance)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collapses three rapid lease changes into a single Skip fire (two legs) after 600 ms", async () => {
    const { wrapper, state } = setup(null);

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

describe("useLongLeaseDetails — Skip route legs target the leased asset", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("routes both the down payment and the borrowed LPN into the leased asset, not the stable", async () => {
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
    expect(downPaymentLeg[1], "down payment leg swaps into the leased asset").toBe("ibc/BTC");
    expect(borrowLeg[0], "borrow leg starts from the borrowed LPN").toBe("ibc/LPN");
    expect(borrowLeg[1], "borrow leg swaps into the leased asset, not the stable").toBe("ibc/BTC");
    wrapper.unmount();
  });
});

describe("useLongLeaseDetails — liquidation argument order", () => {
  it("passes unitAsset (from borrow) then stableAsset (from total) to calculateLiquidation", () => {
    const { api, wrapper } = setup(makeLease());

    void api.calculateLique.value;

    expect(hoisted.calculateLiquidation).toHaveBeenCalledTimes(1);
    const call = hoisted.calculateLiquidation.mock.calls[0];
    if (call === undefined) throw new Error("expected calculateLiquidation to have been called");
    const [unitAsset, stableAsset] = call;
    // borrow 500_000_000 at 8 dp = 5; total 2_000_000_000 at 6 dp = 2000.
    expect(Number(unitAsset.toString()), "first arg is the borrowed unit (5), not the stable").toBe(5);
    expect(Number(stableAsset.toString()), "second arg is the stable total (2000), not the unit").toBe(2000);
    wrapper.unmount();
  });
});

describe("useLongLeaseDetails — percentLique sign", () => {
  it("reports the liquidation distance as a negative percentage", () => {
    // Asset price 2_000_000 at 6 dp = 2; liquidation 1 -> (2 - 1) / 2 = 50%, Long-signed.
    hoisted.calculateLiquidation.mockReturnValue(new Dec("1"));
    const { api, wrapper } = setup(makeLease());

    expect(api.percentLique.value, "Long liquidation distance carries a leading minus").toBe("-50");
    wrapper.unmount();
  });

  it("reports zero without a sign when the liquidation price is zero", () => {
    hoisted.calculateLiquidation.mockReturnValue(new Dec("0"));
    const { api, wrapper } = setup(makeLease());

    expect(api.percentLique.value, "zero liquidation short-circuits to unsigned zero").toBe("0");
    wrapper.unmount();
  });
});

describe("useLongLeaseDetails — teardown on unmount (per-instance timers)", () => {
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

  it("keeps a second instance's pending fire alive when the first unmounts", async () => {
    const first = setup(null);
    const second = setup(null);
    first.state.lease = makeLease({ borrow: { ticker: "ALL_BTC", amount: "1" } });
    second.state.lease = makeLease({ borrow: { ticker: "ALL_BTC", amount: "2" } });
    await nextTick(); // arms both timers

    first.wrapper.unmount(); // must clear only its own timer

    await vi.advanceTimersByTimeAsync(600);
    expect(hoisted.getRoute, "only the surviving instance fires — exactly its two route legs").toHaveBeenCalledTimes(2);
    second.wrapper.unmount();
  });
});
