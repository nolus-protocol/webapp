import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dec } from "@keplr-wallet/unit";

const hoisted = vi.hoisted(() => ({
  getDownpaymentRange: vi.fn(),
  pricesState: {} as Record<string, { price: string }>,
  // Dec cannot be constructed here — vi.hoisted runs before the import is live.
  // Set to a real Dec in beforeEach; the CurrencyUtils mock reads it lazily.
  balanceDec: null as Dec | null
}));

vi.mock("@/common/utils/LeaseConfigService", () => ({
  getDownpaymentRange: hoisted.getDownpaymentRange
}));

vi.mock("@/common/utils/NumberFormatUtils", () => ({
  formatTokenBalance: () => "0"
}));

vi.mock("@/common/stores/prices", () => ({
  usePricesStore: () => ({
    get prices() {
      return hoisted.pricesState;
    }
  })
}));

vi.mock("@nolus/nolusjs", () => ({
  CurrencyUtils: {
    convertDenomToMinimalDenom: () => ({ amount: "1" }),
    calculateBalance: () => ({ toDec: () => hoisted.balanceDec })
  }
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k })
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/router", () => ({ RouteNames: { LEASES: "leases" } }));

import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useLeaseOpen } from "./useLeaseOpen";

type LeaseOpenApi = ReturnType<typeof useLeaseOpen>;

function setup() {
  let api!: LeaseOpenApi;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useLeaseOpen();
        return () => null;
      }
    })
  );
  return { api, wrapper };
}

const DOWN_PAYMENT = {
  key: "USDC_NOBLE@OSMOSIS-OSMOSIS-USDC_NOBLE",
  ibcData: "ibc/USDC",
  decimal_digits: 6,
  shortName: "USDC",
  balance: { amount: "100000000" }
};
const LOAN = { key: "ALL_BTC@OSMOSIS-OSMOSIS-ALL_BTC" };

describe("useLeaseOpen — isDownPaymentAmountValid (submit-path min/max enforcement)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.pricesState = { "USDC_NOBLE@OSMOSIS-OSMOSIS-USDC_NOBLE": { price: "1" } };
    hoisted.balanceDec = new Dec(1);
  });

  it("rejects an out-of-range amount on the submit path (awaits the async min/max check)", async () => {
    // Range demands at least 100; the computed balance is 1 → below min.
    hoisted.getDownpaymentRange.mockResolvedValue({ ALL_BTC: { min: "100", max: "1000" } });
    const { api, wrapper } = setup();
    api.amount.value = "1";

    const valid = await api.isDownPaymentAmountValid(DOWN_PAYMENT, LOAN);

    expect(valid).toBe(false);
    expect(api.amountErrorMsg.value).toBe("message.lease-min-error");
    wrapper.unmount();
  });

  it("accepts an in-range amount on the submit path", async () => {
    hoisted.getDownpaymentRange.mockResolvedValue({ ALL_BTC: { min: "0", max: "1000" } });
    hoisted.balanceDec = new Dec(5);
    const { api, wrapper } = setup();
    api.amount.value = "5";

    const valid = await api.isDownPaymentAmountValid(DOWN_PAYMENT, LOAN);

    expect(valid).toBe(true);
    expect(api.amountErrorMsg.value).toBe("");
    wrapper.unmount();
  });

  it("still rejects a missing amount before reaching the range check", async () => {
    const { api, wrapper } = setup();
    api.amount.value = "";

    const valid = await api.isDownPaymentAmountValid(DOWN_PAYMENT, LOAN);

    expect(valid).toBe(false);
    expect(api.amountErrorMsg.value).toBe("message.missing-amount");
    wrapper.unmount();
  });

  it("rejects with integer-out-of-range when no loan option is selected", async () => {
    hoisted.getDownpaymentRange.mockResolvedValue({ ALL_BTC: { min: "0", max: "1000" } });
    const { api, wrapper } = setup();
    api.amount.value = "5";

    const valid = await api.isDownPaymentAmountValid(DOWN_PAYMENT, undefined);

    expect(valid).toBe(false);
    expect(api.amountErrorMsg.value).toBe("message.integer-out-of-range");
    wrapper.unmount();
  });
});
