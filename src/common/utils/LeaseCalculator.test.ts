import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Dec } from "@keplr-wallet/unit";
import { LeaseCalculator } from "./LeaseCalculator";
import type { CurrencyInfo, PriceProvider, CurrencyProvider } from "./LeaseCalculator";
import type {
  LeaseInfo,
  LeaseStatusType,
  LeaseDebtInfo,
  LeaseInterestInfo,
  LeaseEtlData,
  LeaseInProgress,
  LeaseClosePolicy,
  LeasePnlInfo
} from "@/common/api";
import { LEASE_DUE } from "@/config/global";

// ============================================================================
// Test helpers
// ============================================================================

const makePriceProvider = (prices: Record<string, number> = {}): PriceProvider => ({
  getPriceAsNumber: vi.fn((key: string) => (key in prices ? prices[key] : 1))
});

interface MakeCurrencyProviderOpts {
  currencies?: Record<string, CurrencyInfo>;
  lpnCurrency?: CurrencyInfo;
  positionType?: "Long" | "Short";
}

const makeCurrencyProvider = (opts: MakeCurrencyProviderOpts = {}): CurrencyProvider => ({
  getCurrency: vi.fn((ticker: string, _protocol: string) => opts.currencies?.[ticker]),
  getLpnCurrency: vi.fn((_protocol: string) => opts.lpnCurrency),
  getPositionType: vi.fn((_protocol: string) => opts.positionType ?? "Long")
});

const defaultDebt: LeaseDebtInfo = {
  ticker: "USDC",
  principal: "0",
  overdue_margin: "0",
  overdue_interest: "0",
  due_margin: "0",
  due_interest: "0",
  total: "0"
};

const defaultInterest: LeaseInterestInfo = {
  loan_rate: 0,
  margin_rate: 0,
  annual_rate_percent: 0
};

interface MakeLeaseOverrides {
  address?: string;
  protocol?: string;
  status?: LeaseStatusType;
  amount?: { ticker: string; amount: string; amount_usd?: string };
  debt?: Partial<LeaseDebtInfo>;
  interest?: Partial<LeaseInterestInfo>;
  liquidation_price?: string;
  pnl?: LeasePnlInfo;
  close_policy?: LeaseClosePolicy | null;
  overdue_collect_in?: string;
  in_progress?: LeaseInProgress | null;
  etl_data?: LeaseEtlData | null;
}

const makeLease = (overrides: MakeLeaseOverrides = {}): LeaseInfo => {
  const lease: LeaseInfo = {
    address: overrides.address ?? "nolus1lease",
    protocol: overrides.protocol ?? "osmosis-osmosis-usdc_noble",
    status: overrides.status ?? "opened",
    amount: overrides.amount ?? { ticker: "ATOM", amount: "0" },
    debt: { ...defaultDebt, ...(overrides.debt ?? {}) },
    interest: { ...defaultInterest, ...(overrides.interest ?? {}) }
  };
  if (overrides.liquidation_price !== undefined) lease.liquidation_price = overrides.liquidation_price;
  if (overrides.pnl !== undefined) lease.pnl = overrides.pnl;
  if (overrides.close_policy !== undefined && overrides.close_policy !== null)
    lease.close_policy = overrides.close_policy;
  if (overrides.overdue_collect_in !== undefined) lease.overdue_collect_in = overrides.overdue_collect_in;
  if (overrides.in_progress !== undefined && overrides.in_progress !== null) lease.in_progress = overrides.in_progress;
  if (overrides.etl_data !== undefined && overrides.etl_data !== null) lease.etl_data = overrides.etl_data;
  return lease;
};

// Bias toward stable Dec equality comparisons via string form.
const decEq = (a: Dec, expected: string) => expect(a.toString()).toBe(new Dec(expected).toString());

// ============================================================================
// Tests
// ============================================================================

describe("LeaseCalculator", () => {
  let calc: LeaseCalculator;

  beforeEach(() => {
    calc = new LeaseCalculator(makePriceProvider(), makeCurrencyProvider());
  });

  // --------------------------------------------------------------------------
  describe("calculateDebt", () => {
    it("should sum all 5 debt components and scale by lpnDecimals=6", () => {
      const lease = makeLease({
        debt: {
          principal: "50000000000",
          overdue_margin: "1000000",
          overdue_interest: "2000000",
          due_margin: "3000000",
          due_interest: "4000000",
          total: "50010000000"
        }
      });
      const { totalDebt, interestDue } = calc.calculateDebt(lease, 6);
      decEq(totalDebt, "50010");
      decEq(interestDue, "10");
    });

    it("should scale by lpnDecimals=18", () => {
      const lease = makeLease({
        debt: {
          principal: "1000000000000000000", // 1e18
          overdue_margin: "2000000000000000000",
          overdue_interest: "0",
          due_margin: "0",
          due_interest: "0",
          total: "3000000000000000000"
        }
      });
      const { totalDebt, interestDue } = calc.calculateDebt(lease, 18);
      decEq(totalDebt, "3");
      decEq(interestDue, "2");
    });

    it("should return zero when all components are 0", () => {
      const lease = makeLease();
      const { totalDebt, interestDue } = calc.calculateDebt(lease, 6);
      expect(totalDebt.isZero()).toBe(true);
      expect(interestDue.isZero()).toBe(true);
    });

    it("throws when a debt amount is not a valid numeric string", () => {
      const lease = makeLease({ debt: { principal: "not-a-number" } });
      expect(() => calc.calculateDebt(lease, 6)).toThrow(Error);
    });
  });

  // --------------------------------------------------------------------------
  describe("calculateInterestRates", () => {
    it("should compute annual + monthly rate", () => {
      const lease = makeLease({ interest: { annual_rate_percent: 10 } });
      const { interestRate, interestRateMonthly } = calc.calculateInterestRates(lease);
      decEq(interestRate, "10");
      // 10 / 12 = 0.8333... — JS float division before Dec wrapping
      expect(interestRateMonthly.toString(4)).toBe(new Dec(10 / 12).toString(4));
    });

    it("should return zero rates when annual rate is undefined", () => {
      // Simulate a lease whose interest object has no annual_rate_percent.
      const lease = makeLease();
      // Force the undefined branch by replacing the typed field.
      (lease.interest as unknown as { annual_rate_percent: undefined }).annual_rate_percent = undefined;
      const { interestRate, interestRateMonthly } = calc.calculateInterestRates(lease);
      expect(interestRate.isZero()).toBe(true);
      expect(interestRateMonthly.isZero()).toBe(true);
    });

    it("should handle fractional rates", () => {
      const lease = makeLease({ interest: { annual_rate_percent: 17.4 } });
      const { interestRate, interestRateMonthly } = calc.calculateInterestRates(lease);
      decEq(interestRate, "17.4");
      expect(interestRateMonthly.toString(6)).toBe(new Dec(17.4 / 12).toString(6));
    });
  });

  // --------------------------------------------------------------------------
  describe("calculateLiquidationPrice", () => {
    describe("long position", () => {
      it("should compute long as stable/unit/0.9", () => {
        const lease = makeLease();
        const unit = new Dec("1"); // 1 unit of asset
        const stable = new Dec("0.9"); // 0.9 stable — so result = 0.9/1/0.9 = 1
        const price = calc.calculateLiquidationPrice(lease, "long", unit, stable);
        decEq(price, "1");
      });

      it("should return Dec(0) when unitAsset is not positive", () => {
        const lease = makeLease();
        const price = calc.calculateLiquidationPrice(lease, "long", new Dec(0), new Dec(100));
        expect(price.isZero()).toBe(true);
      });
    });

    describe("short position", () => {
      it("should compute short as unit*0.9/stable", () => {
        const lease = makeLease();
        const unit = new Dec("1");
        const stable = new Dec("0.9");
        const price = calc.calculateLiquidationPrice(lease, "short", unit, stable);
        // 1 * 0.9 / 0.9 = 1
        decEq(price, "1");
      });

      it("should use short formula for any non-'long' positionType", () => {
        const lease = makeLease();
        const unit = new Dec("2");
        const stable = new Dec("1");
        // short formula: 2 * 0.9 / 1 = 1.8
        const priceShort = calc.calculateLiquidationPrice(lease, "short", unit, stable);
        decEq(priceShort, "1.8");
        // "long" formula would be: 1 / 2 / 0.9 ≈ 0.555... — distinct from 1.8
        const priceOther = calc.calculateLiquidationPrice(lease, "arbitrary", unit, stable);
        decEq(priceOther, "1.8");
      });
    });

    describe("short-circuit to backend value", () => {
      it("should use backend-provided liquidation_price when present", () => {
        const lease = makeLease({ liquidation_price: "42.5" });
        const price = calc.calculateLiquidationPrice(lease, "long", new Dec("1"), new Dec("1"));
        decEq(price, "42.5");
      });

      it("should NOT short-circuit when liquidation_price is undefined", () => {
        const lease = makeLease();
        // stable/unit/0.9 = 2/1/0.9 ≈ 2.2222...
        const price = calc.calculateLiquidationPrice(lease, "long", new Dec("1"), new Dec("2"));
        expect(price.toString(4)).toBe(new Dec(2).quo(new Dec(1)).quo(new Dec(0.9)).toString(4));
      });
    });

    describe("non-opened or zero quantity", () => {
      it.each<[LeaseStatusType]>([["paid_off"], ["closing"], ["closed"], ["liquidated"], ["opening"]])(
        "should return Dec(0) when status is %s",
        (status) => {
          const lease = makeLease({ status });
          const price = calc.calculateLiquidationPrice(lease, "long", new Dec("1"), new Dec("1"));
          expect(price.isZero()).toBe(true);
        }
      );

      it("should return Dec(0) when stableAsset is 0", () => {
        const lease = makeLease();
        const price = calc.calculateLiquidationPrice(lease, "long", new Dec("1"), new Dec(0));
        expect(price.isZero()).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  describe("calculateHealth", () => {
    it("should return {100, green} when status is not opened", () => {
      const lease = makeLease({ status: "closed" });
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(50));
      expect(health).toBe(100);
      expect(healthStatus).toBe("green");
    });

    it("should return {100, green} when asset value is 0", () => {
      const lease = makeLease();
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(0), new Dec(0));
      expect(health).toBe(100);
      expect(healthStatus).toBe("green");
    });

    it("should compute health=100 at LTV ratio 0.2 (clamped)", () => {
      const lease = makeLease();
      // debt/asset = 0.2 → ltv_var = 0, healthDec = 1, health = 100
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(20));
      expect(health).toBe(100);
      expect(healthStatus).toBe("green");
    });

    it("should compute health at LTV ratio 0.4", () => {
      const lease = makeLease();
      // r=0.4, ltv_var=0.2, healthDec = 1 - 0.2/0.7 ≈ 0.71428 → 71.43
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(40));
      expect(health).toBeCloseTo(71.43, 1);
      expect(healthStatus).toBe("green");
    });

    it("should clamp to 0 when LTV ratio is very high", () => {
      const lease = makeLease();
      // debt way above asset → healthDec very negative → clamped to 0
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(200));
      expect(health).toBe(0);
      expect(healthStatus).toBe("red");
    });

    it("should clamp to 100 when LTV ratio is below 0.2", () => {
      const lease = makeLease();
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(5));
      expect(health).toBe(100);
      expect(healthStatus).toBe("green");
    });

    it("should return green at exactly health=25", () => {
      const lease = makeLease();
      // healthDec = 0.25 → ltv_var = 0.525 → r = 0.725 → debt=72.5, asset=100
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec("72.5"));
      expect(health).toBe(25);
      expect(healthStatus).toBe("green");
    });

    it("should return yellow when 10 < health < 25", () => {
      const lease = makeLease();
      // target healthDec = 0.15 → ltv_var = 0.595 → r = 0.795 → debt=79.5
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec("79.5"));
      expect(health).toBeGreaterThan(10);
      expect(health).toBeLessThan(25);
      expect(healthStatus).toBe("yellow");
    });

    it("should return red at exactly health=10", () => {
      const lease = makeLease();
      // healthDec = 0.10 → ltv_var = 0.63 → r = 0.83 → debt=83
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(83));
      expect(health).toBe(10);
      expect(healthStatus).toBe("red");
    });

    it("should return red when health < 10", () => {
      const lease = makeLease();
      // r = 0.9 → ltv_var = 0.7 → healthDec = 0 → health=0
      const { health, healthStatus } = calc.calculateHealth(lease, new Dec(100), new Dec(90));
      expect(health).toBe(0);
      expect(healthStatus).toBe("red");
    });
  });

  // --------------------------------------------------------------------------
  describe("calculatePnl", () => {
    it("should return {0, 0, pnlPositive:true} when totalInvested is 0", () => {
      const { pnlAmount, pnlPercent, pnlPositive } = calc.calculatePnl(
        new Dec(100),
        new Dec(50),
        new Dec(0),
        new Dec(0),
        new Dec(0)
      );
      expect(pnlAmount.isZero()).toBe(true);
      expect(pnlPercent.isZero()).toBe(true);
      expect(pnlPositive).toBe(true);
    });

    it("should compute pnl = current - debt - down + fee - repay", () => {
      const current = new Dec(200);
      const debt = new Dec(80);
      const down = new Dec(50);
      const fee = new Dec(5);
      const repay = new Dec(10);
      // pnl = 200 - 80 - 50 + 5 - 10 = 65
      const { pnlAmount, pnlPercent, pnlPositive } = calc.calculatePnl(current, debt, down, fee, repay);
      decEq(pnlAmount, "65");
      // percent = 65 / (50+10) * 100 ≈ 108.33
      expect(pnlPercent.toString(4)).toBe(new Dec(65).quo(new Dec(60)).mul(new Dec(100)).toString(4));
      expect(pnlPositive).toBe(true);
    });

    it("should ADD fee rather than subtract (FINDING: feeSign)", () => {
      // Zero out all other deltas so fee is the only moving piece.
      // current=0, debt=0, down=1 (needed so totalInvested>0), repay=0, fee=7
      // If fee subtracts: pnl = 0 - 0 - 1 - 7 - 0 = -8
      // If fee adds:     pnl = 0 - 0 - 1 + 7 - 0 = 6
      const { pnlAmount } = calc.calculatePnl(new Dec(0), new Dec(0), new Dec(1), new Dec(7), new Dec(0));
      decEq(pnlAmount, "6");
    });

    it("should return negative pnl when debt exceeds current", () => {
      // current=50, debt=100, down=30, fee=0, repay=10 → 50-100-30+0-10 = -90
      const { pnlAmount, pnlPositive } = calc.calculatePnl(
        new Dec(50),
        new Dec(100),
        new Dec(30),
        new Dec(0),
        new Dec(10)
      );
      decEq(pnlAmount, "-90");
      expect(pnlPositive).toBe(false);
    });

    it("should compute pnlPercent using downPayment+repaymentValue in denominator", () => {
      // pnl = 10 - 0 - 5 + 0 - 5 = 0 → percent = 0
      const { pnlAmount, pnlPercent, pnlPositive } = calc.calculatePnl(
        new Dec(10),
        new Dec(0),
        new Dec(5),
        new Dec(0),
        new Dec(5)
      );
      expect(pnlAmount.isZero()).toBe(true);
      expect(pnlPercent.isZero()).toBe(true);
      expect(pnlPositive).toBe(true); // zero counts as positive per source
    });
  });

  // --------------------------------------------------------------------------
  describe("calculateStopLoss", () => {
    it("should return null when close_policy is undefined", () => {
      const lease = makeLease();
      expect(calc.calculateStopLoss(lease, "long", new Dec(1), new Dec(1))).toBeNull();
    });

    it("should return null when close_policy.stop_loss is undefined", () => {
      const lease = makeLease({ close_policy: { take_profit: 1200 } });
      expect(calc.calculateStopLoss(lease, "long", new Dec(1), new Dec(1))).toBeNull();
    });

    it("should return null when unitAsset is zero", () => {
      const lease = makeLease({ close_policy: { stop_loss: 800 } });
      expect(calc.calculateStopLoss(lease, "long", new Dec(0), new Dec(1))).toBeNull();
    });

    it("should return null when stableAsset is zero", () => {
      const lease = makeLease({ close_policy: { stop_loss: 800 } });
      expect(calc.calculateStopLoss(lease, "long", new Dec(1), new Dec(0))).toBeNull();
    });

    it("should compute long slPrice = stable / (sl/1000) / unit", () => {
      const lease = makeLease({ close_policy: { stop_loss: 800 } });
      // stable=8, unit=1 → 8 / 0.8 / 1 = 10
      const result = calc.calculateStopLoss(lease, "long", new Dec(1), new Dec(8));
      expect(result).not.toBeNull();
      decEq(result!.price, "10");
      expect(result!.percent).toBe(80);
    });

    it("should compute short slPrice = unit * (sl/1000) / stable", () => {
      const lease = makeLease({ close_policy: { stop_loss: 750 } });
      // unit=4, stable=1 → 4 * 0.75 / 1 = 3
      const result = calc.calculateStopLoss(lease, "short", new Dec(4), new Dec(1));
      expect(result).not.toBeNull();
      decEq(result!.price, "3");
      expect(result!.percent).toBe(75);
    });

    it("should return slPercent as sl/10", () => {
      const lease = makeLease({ close_policy: { stop_loss: 750 } });
      const result = calc.calculateStopLoss(lease, "long", new Dec(1), new Dec(1));
      expect(result!.percent).toBe(75);
    });
  });

  // --------------------------------------------------------------------------
  describe("calculateTakeProfit", () => {
    it("should return null when close_policy is undefined", () => {
      const lease = makeLease();
      expect(calc.calculateTakeProfit(lease, "long", new Dec(1), new Dec(1))).toBeNull();
    });

    it("should return null when take_profit is undefined", () => {
      const lease = makeLease({ close_policy: { stop_loss: 800 } });
      expect(calc.calculateTakeProfit(lease, "long", new Dec(1), new Dec(1))).toBeNull();
    });

    it("should return null when unitAsset is zero", () => {
      const lease = makeLease({ close_policy: { take_profit: 1200 } });
      expect(calc.calculateTakeProfit(lease, "long", new Dec(0), new Dec(1))).toBeNull();
    });

    it("should compute long tpPrice", () => {
      const lease = makeLease({ close_policy: { take_profit: 1200 } });
      // stable=12, unit=1 → 12 / 1.2 / 1 = 10
      const result = calc.calculateTakeProfit(lease, "long", new Dec(1), new Dec(12));
      expect(result).not.toBeNull();
      decEq(result!.price, "10");
      expect(result!.percent).toBe(120);
    });

    it("should compute short tpPrice", () => {
      const lease = makeLease({ close_policy: { take_profit: 1500 } });
      // unit=2, stable=1 → 2 * 1.5 / 1 = 3
      const result = calc.calculateTakeProfit(lease, "short", new Dec(2), new Dec(1));
      expect(result).not.toBeNull();
      decEq(result!.price, "3");
      expect(result!.percent).toBe(150);
    });
  });

  // --------------------------------------------------------------------------
  describe("parseInterestDueWarning", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return falsy values when overdue_collect_in is missing", () => {
      const lease = makeLease();
      const { interestDueWarning, interestDueDate } = calc.parseInterestDueWarning(lease);
      expect(interestDueWarning).toBe(false);
      expect(interestDueDate).toBeNull();
    });

    it("should return interestDueWarning=true when overdue_collect_in <= LEASE_DUE", () => {
      const lease = makeLease({ overdue_collect_in: String(LEASE_DUE) });
      const { interestDueWarning } = calc.parseInterestDueWarning(lease);
      expect(interestDueWarning).toBe(true);
    });

    it("should return interestDueWarning=false when overdue_collect_in > LEASE_DUE", () => {
      const lease = makeLease({ overdue_collect_in: String(LEASE_DUE + 1) });
      const { interestDueWarning } = calc.parseInterestDueWarning(lease);
      expect(interestDueWarning).toBe(false);
    });

    it("throws when overdue_collect_in is not a valid BigInt", () => {
      const lease = makeLease({ overdue_collect_in: "abc" });
      expect(() => calc.parseInterestDueWarning(lease)).toThrow(SyntaxError);
    });

    it("should use Date.now() as the reference for interestDueDate", () => {
      // LEASE_DUE = 3 days in ns → 3 days in ms = 3*24*3600*1000 = 259_200_000
      const lease = makeLease({ overdue_collect_in: String(LEASE_DUE) });
      const { interestDueDate } = calc.parseInterestDueWarning(lease);
      expect(interestDueDate).not.toBeNull();
      // Date.now() fixed at 2026-01-01; add 3 days in ms
      const expected = new Date("2026-01-01T00:00:00.000Z").getTime() + 3 * 24 * 60 * 60 * 1000;
      expect(interestDueDate!.getTime()).toBe(expected);
    });
  });

  // --------------------------------------------------------------------------
  describe("parseEtlData", () => {
    it("should scale downpayment by collateralDecimals", () => {
      const lease = makeLease({
        etl_data: { downpayment_amount: "100000000" } // 1e8
      });
      // collateral decimals=8 → 1.0
      const { downPayment } = calc.parseEtlData(lease, "long", 8, 6);
      decEq(downPayment, "1");
    });

    it("should scale fee by assetDecimals", () => {
      const lease = makeLease({
        etl_data: { fee: "50000000" } // 5e7
      });
      // asset decimals=8 → 0.5
      const { fee } = calc.parseEtlData(lease, "long", 6, 8);
      decEq(fee, "0.5");
    });

    it("should use etl_data.price as openingPrice for long", () => {
      const lease = makeLease({ etl_data: { price: "12.34", lpn_price: "99.9" } });
      const { openingPrice } = calc.parseEtlData(lease, "long", 6, 6);
      decEq(openingPrice, "12.34");
    });

    it("should use etl_data.lpn_price as openingPrice for short", () => {
      const lease = makeLease({ etl_data: { price: "12.34", lpn_price: "99.9" } });
      const { openingPrice } = calc.parseEtlData(lease, "short", 6, 6);
      decEq(openingPrice, "99.9");
    });

    it("should NOT scale repaymentValue (treats as already-decimal)", () => {
      const lease = makeLease({ etl_data: { repayment_value: "42" } });
      const { repaymentValue } = calc.parseEtlData(lease, "long", 6, 6);
      decEq(repaymentValue, "42");
    });

    it("should return zero defaults when etl_data is undefined", () => {
      const lease = makeLease();
      const { downPayment, openingPrice, fee, repaymentValue } = calc.parseEtlData(lease, "long", 6, 6);
      expect(downPayment.isZero()).toBe(true);
      expect(openingPrice.isZero()).toBe(true);
      expect(fee.isZero()).toBe(true);
      expect(repaymentValue.isZero()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  describe("parseInProgressType", () => {
    it("should return null when in_progress is undefined", () => {
      const lease = makeLease();
      expect(calc.parseInProgressType(lease)).toBeNull();
    });

    it.each<["opening" | "repayment" | "close" | "liquidation" | "slippage_protection", LeaseInProgress]>([
      ["opening", { opening: { stage: "init" } }],
      ["repayment", { repayment: {} }],
      ["close", { close: {} }],
      ["liquidation", { liquidation: { cause: "price" } }],
      ["slippage_protection", { slippage_protection: {} }]
    ])("should return %s when in_progress contains that key", (expected, in_progress) => {
      const lease = makeLease({ in_progress });
      expect(calc.parseInProgressType(lease)).toBe(expected);
    });

    it("should return null when in_progress has no recognized key", () => {
      const lease = makeLease();
      // Force unrecognized shape — casting as any intentionally for invalid payload.
      lease.in_progress = { unknown_key: {} } as unknown as LeaseInProgress;
      expect(calc.parseInProgressType(lease)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  describe("calculateDisplayData (integration)", () => {
    it("should orchestrate display data for a typical long lease", () => {
      const currencies: Record<string, CurrencyInfo> = {
        ATOM: { key: "ATOM", decimal_digits: 6 },
        USDC: { key: "USDC", decimal_digits: 6 }
      };
      const lpn: CurrencyInfo = { key: "USDC", decimal_digits: 6 };
      const price = makePriceProvider({ ATOM: 10, USDC: 1 });
      const currency = makeCurrencyProvider({ currencies, lpnCurrency: lpn, positionType: "Long" });
      const c = new LeaseCalculator(price, currency);

      const lease = makeLease({
        status: "opened",
        amount: { ticker: "ATOM", amount: "10000000" }, // 10 ATOM
        debt: {
          principal: "20000000", // 20 USDC
          overdue_margin: "0",
          overdue_interest: "0",
          due_margin: "0",
          due_interest: "0",
          total: "20000000"
        },
        interest: { loan_rate: 8, margin_rate: 2, annual_rate_percent: 10 }
      });

      const data = c.calculateDisplayData(lease);

      // 10 ATOM @ $10 = $100 asset value; 20 USDC = $20 debt → ltv_var = 0, health=100
      decEq(data.totalDebt, "20");
      decEq(data.totalDebtUsd, "20");
      decEq(data.assetValueUsd, "100");
      expect(data.health).toBe(100);
      expect(data.healthStatus).toBe("green");
      expect(data.positionType).toBe("long");
      // liquidation (long): stable=20, unit=10 → 20/10/0.9 ≈ 2.222...
      expect(data.liquidationPrice.toString(4)).toBe(new Dec(20).quo(new Dec(10)).quo(new Dec(0.9)).toString(4));
    });

    it("should resolve collateralDecimals from etl_data.collateral_symbol when present", () => {
      const currencies: Record<string, CurrencyInfo> = {
        ATOM: { key: "ATOM", decimal_digits: 6 },
        WBTC: { key: "WBTC", decimal_digits: 8 }
      };
      const lpn: CurrencyInfo = { key: "USDC", decimal_digits: 6 };
      const price = makePriceProvider({ ATOM: 10, USDC: 1, WBTC: 100000 });
      const currency = makeCurrencyProvider({ currencies, lpnCurrency: lpn, positionType: "Long" });
      const c = new LeaseCalculator(price, currency);

      const lease = makeLease({
        amount: { ticker: "ATOM", amount: "10000000" },
        debt: { principal: "1000000", total: "1000000" },
        // collateral_symbol=WBTC → decimal_digits=8 → 1e8 / 1e8 = 1
        etl_data: { collateral_symbol: "WBTC", downpayment_amount: "100000000" }
      });
      const data = c.calculateDisplayData(lease);
      decEq(data.downPayment, "1");
    });

    it("should fall back to lpnCurrency decimals when collateral_symbol does not resolve", () => {
      const currencies: Record<string, CurrencyInfo> = {
        ATOM: { key: "ATOM", decimal_digits: 6 }
      };
      const lpn: CurrencyInfo = { key: "USDC", decimal_digits: 6 };
      const price = makePriceProvider({ ATOM: 10, USDC: 1 });
      const currency = makeCurrencyProvider({ currencies, lpnCurrency: lpn, positionType: "Long" });
      const c = new LeaseCalculator(price, currency);

      const lease = makeLease({
        amount: { ticker: "ATOM", amount: "10000000" },
        debt: { principal: "1000000", total: "1000000" },
        // collateral_symbol lookup returns undefined → fall back to lpn decimals (6) → 1e6 / 1e6 = 1
        etl_data: { collateral_symbol: "UNKNOWN_COLLATERAL", downpayment_amount: "1000000" }
      });
      const data = c.calculateDisplayData(lease);
      decEq(data.downPayment, "1");
    });

    it("should fall back to 8 decimals when currency lookup returns undefined (FINDING-7)", () => {
      // No currencies map → getCurrency returns undefined for the ticker.
      // Also no lpnCurrency → lpnDecimals defaults to 6.
      const price = makePriceProvider({});
      const currency = makeCurrencyProvider({ positionType: "Long" });
      const c = new LeaseCalculator(price, currency);

      const lease = makeLease({
        amount: { ticker: "UNKNOWN", amount: "100000000" }, // 1e8
        etl_data: { fee: "100000000" }
      });
      const data = c.calculateDisplayData(lease);
      // With assetDecimals default 8, fee = 100_000_000 / 1e8 = 1
      decEq(data.fee, "1");
    });
  });

  // --------------------------------------------------------------------------
  describe("static filters and aggregates", () => {
    describe("filterOpenLeases", () => {
      it("should keep opened and opening only", () => {
        const leases: LeaseInfo[] = [
          makeLease({ address: "a", status: "opened" }),
          makeLease({ address: "b", status: "opening" }),
          makeLease({ address: "c", status: "closed" }),
          makeLease({ address: "d", status: "liquidated" }),
          makeLease({ address: "e", status: "paid_off" })
        ];
        const result = LeaseCalculator.filterOpenLeases(leases);
        expect(result.map((l) => l.address)).toEqual(["a", "b"]);
      });
    });

    describe("filterClosedLeases", () => {
      it("should keep closed, closing, liquidated, paid_off", () => {
        const leases: LeaseInfo[] = [
          makeLease({ address: "a", status: "opened" }),
          makeLease({ address: "b", status: "opening" }),
          makeLease({ address: "c", status: "closed" }),
          makeLease({ address: "d", status: "closing" }),
          makeLease({ address: "e", status: "liquidated" }),
          makeLease({ address: "f", status: "paid_off" })
        ];
        const result = LeaseCalculator.filterClosedLeases(leases);
        expect(result.map((l) => l.address)).toEqual(["c", "d", "e", "f"]);
      });
    });

    describe("calculateTotalPnl", () => {
      it("should sum pnl.amount across leases", () => {
        const leases: LeaseInfo[] = [
          makeLease({
            pnl: { amount: "10", percent: "1", downpayment: "0", pnl_positive: true }
          }),
          makeLease({
            pnl: { amount: "20.5", percent: "2", downpayment: "0", pnl_positive: true }
          }),
          makeLease({
            pnl: { amount: "-5", percent: "-1", downpayment: "0", pnl_positive: false }
          })
        ];
        const total = LeaseCalculator.calculateTotalPnl(leases);
        decEq(total, "25.5");
      });

      it("should return Dec(0) for empty array", () => {
        const total = LeaseCalculator.calculateTotalPnl([]);
        expect(total.isZero()).toBe(true);
      });

      it("should skip leases with no pnl field", () => {
        const leases: LeaseInfo[] = [
          makeLease({ pnl: { amount: "10", percent: "1", downpayment: "0", pnl_positive: true } }),
          makeLease() // no pnl
        ];
        const total = LeaseCalculator.calculateTotalPnl(leases);
        decEq(total, "10");
      });
    });
  });
});
