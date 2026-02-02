/**
 * LeaseCalculator - Business logic for lease calculations
 *
 * Extracts calculation logic from the leases store to:
 * - Enable unit testing of calculations without store dependencies
 * - Allow reuse in different contexts (store, components, services)
 * - Keep the store focused on state management
 */

import { Dec } from "@keplr-wallet/unit";
import type { LeaseInfo } from "@/common/api";
import { PERCENT, PERMILLE, PositionTypes, ProtocolsConfig, INTEREST_DECIMALS, MONTHS, LEASE_DUE } from "@/config/global";

// ============================================================================
// Types
// ============================================================================

export interface CurrencyInfo {
  key: string;
  decimal_digits: number;
}

export interface PriceProvider {
  getPriceAsNumber(key: string): number;
}

export interface CurrencyProvider {
  getCurrency(ticker: string, protocol: string): CurrencyInfo | undefined;
  getLpnCurrency(protocol: string): CurrencyInfo | undefined;
}

export interface LeaseDisplayData {
  lease: LeaseInfo;
  // Computed values
  totalDebt: Dec;
  totalDebtUsd: Dec;
  interestDue: Dec;
  interestRate: Dec;
  interestRateMonthly: Dec;
  liquidationPrice: Dec;
  health: number;
  healthStatus: "green" | "yellow" | "red";
  pnlAmount: Dec;
  pnlPercent: Dec;
  pnlPositive: boolean;
  assetValueUsd: Dec;
  positionType: string;
  // Close policy
  stopLoss: { percent: number; price: Dec } | null;
  takeProfit: { percent: number; price: Dec } | null;
  // Interest due status
  interestDueWarning: boolean;
  interestDueDate: Date | null;
  // ETL data
  downPayment: Dec;
  openingPrice: Dec;
  fee: Dec;
  repaymentValue: Dec;
  // In progress status
  inProgressType: "opening" | "repayment" | "close" | "liquidation" | "transfer_in" | null;
  // Asset amounts
  unitAsset: Dec;
  stableAsset: Dec;
}

// ============================================================================
// LeaseCalculator Class
// ============================================================================

export class LeaseCalculator {
  private priceProvider: PriceProvider;
  private currencyProvider: CurrencyProvider;

  constructor(priceProvider: PriceProvider, currencyProvider: CurrencyProvider) {
    this.priceProvider = priceProvider;
    this.currencyProvider = currencyProvider;
  }

  /**
   * Calculate all display data for a lease
   */
  calculateDisplayData(lease: LeaseInfo): LeaseDisplayData {
    const protocol = lease.protocol;
    const positionType = ProtocolsConfig[protocol]?.type ?? PositionTypes.long;

    // Get currency info
    const ticker = lease.amount.ticker;
    const currency = this.currencyProvider.getCurrency(ticker, protocol);
    const lpnCurrency = this.currencyProvider.getLpnCurrency(protocol);

    // Calculate unit and stable asset amounts
    const unitAsset = currency
      ? new Dec(lease.amount.amount, currency.decimal_digits)
      : new Dec(lease.amount.amount);
    const stableAsset = lpnCurrency
      ? new Dec(lease.debt.principal, lpnCurrency.decimal_digits)
      : new Dec(lease.debt.principal);

    // Calculate debt components
    const { totalDebt, interestDue } = this.calculateDebt(lease);

    // Calculate interest rates
    const { interestRate, interestRateMonthly } = this.calculateInterestRates(lease);

    // Get prices
    const assetPrice = currency
      ? new Dec(this.priceProvider.getPriceAsNumber(currency.key))
      : new Dec(0);
    const lpnPrice = lpnCurrency
      ? new Dec(this.priceProvider.getPriceAsNumber(lpnCurrency.key))
      : new Dec(1);

    // Calculate asset value and debt in USD
    const assetValueUsd = unitAsset.mul(assetPrice);
    const debtAmount = lpnCurrency
      ? new Dec(lease.debt.total, lpnCurrency.decimal_digits)
      : new Dec(lease.debt.total);
    const totalDebtUsd = debtAmount.mul(lpnPrice);

    // Calculate liquidation price
    const liquidationPrice = this.calculateLiquidationPrice(
      lease,
      positionType,
      unitAsset,
      stableAsset
    );

    // Calculate health
    const { health, healthStatus } = this.calculateHealth(
      lease,
      assetValueUsd,
      totalDebtUsd
    );

    // Calculate PnL
    const { pnlAmount, pnlPercent, pnlPositive } = this.calculatePnl(lease);

    // Calculate close policy prices
    const stopLoss = this.calculateStopLoss(lease, positionType, unitAsset, stableAsset);
    const takeProfit = this.calculateTakeProfit(lease, positionType, unitAsset, stableAsset);

    // Parse interest due warning
    const { interestDueWarning, interestDueDate } = this.parseInterestDueWarning(lease);

    // Parse ETL data
    const { downPayment, openingPrice, fee, repaymentValue } = this.parseEtlData(
      lease,
      positionType,
      lpnCurrency?.decimal_digits ?? 6
    );

    // Parse in progress type
    const inProgressType = this.parseInProgressType(lease);

    return {
      lease,
      totalDebt,
      totalDebtUsd,
      interestDue,
      interestRate,
      interestRateMonthly,
      liquidationPrice,
      health,
      healthStatus,
      pnlAmount,
      pnlPercent,
      pnlPositive,
      assetValueUsd,
      positionType,
      stopLoss,
      takeProfit,
      interestDueWarning,
      interestDueDate,
      downPayment,
      openingPrice,
      fee,
      repaymentValue,
      inProgressType,
      unitAsset,
      stableAsset,
    };
  }

  /**
   * Calculate total debt and interest due
   */
  calculateDebt(lease: LeaseInfo): { totalDebt: Dec; interestDue: Dec } {
    const principal = new Dec(lease.debt.principal);
    const overdueMargin = new Dec(lease.debt.overdue_margin);
    const overdueInterest = new Dec(lease.debt.overdue_interest);
    const dueMargin = new Dec(lease.debt.due_margin);
    const dueInterest = new Dec(lease.debt.due_interest);

    const totalDebt = principal
      .add(overdueMargin)
      .add(overdueInterest)
      .add(dueMargin)
      .add(dueInterest);

    const interestDue = overdueMargin
      .add(overdueInterest)
      .add(dueMargin)
      .add(dueInterest);

    return { totalDebt, interestDue };
  }

  /**
   * Calculate annual and monthly interest rates
   */
  calculateInterestRates(lease: LeaseInfo): { interestRate: Dec; interestRateMonthly: Dec } {
    const loanRate = new Dec(lease.interest.loan_rate / PERMILLE);
    const marginRate = new Dec(lease.interest.margin_rate / PERCENT);
    const interestRate = loanRate.add(marginRate);

    const interestRateDecimal = new Dec(
      (Number(lease.interest.loan_rate) + Number(lease.interest.margin_rate)) /
        Math.pow(10, INTEREST_DECIMALS) /
        MONTHS
    );

    return { interestRate, interestRateMonthly: interestRateDecimal };
  }

  /**
   * Calculate liquidation price
   */
  calculateLiquidationPrice(
    lease: LeaseInfo,
    positionType: string,
    unitAsset: Dec,
    stableAsset: Dec
  ): Dec {
    if (lease.liquidation_price) {
      return new Dec(lease.liquidation_price);
    }

    if (
      lease.status !== "opened" ||
      !unitAsset.isPositive() ||
      !stableAsset.isPositive()
    ) {
      return new Dec(0);
    }

    if (positionType === PositionTypes.long) {
      // Long: liquidation = debt / collateral (roughly)
      return stableAsset.quo(unitAsset);
    } else {
      // Short: liquidation = collateral / debt
      return unitAsset.quo(stableAsset);
    }
  }

  /**
   * Calculate health percentage and status
   */
  calculateHealth(
    lease: LeaseInfo,
    assetValueUsd: Dec,
    totalDebtUsd: Dec
  ): { health: number; healthStatus: "green" | "yellow" | "red" } {
    if (lease.status !== "opened" || !assetValueUsd.isPositive()) {
      return { health: 100, healthStatus: "green" };
    }

    const ltv = totalDebtUsd.quo(assetValueUsd).sub(new Dec(0.2));
    const healthDec = new Dec(1).sub(ltv.quo(new Dec(0.7)));
    const health = Math.min(
      100,
      Math.max(0, Number(healthDec.mul(new Dec(PERCENT)).toString(2)))
    );

    let healthStatus: "green" | "yellow" | "red" = "green";
    if (health >= 25) {
      healthStatus = "green";
    } else if (health > 10) {
      healthStatus = "yellow";
    } else {
      healthStatus = "red";
    }

    return { health, healthStatus };
  }

  /**
   * Calculate PnL values
   */
  calculatePnl(lease: LeaseInfo): {
    pnlAmount: Dec;
    pnlPercent: Dec;
    pnlPositive: boolean;
  } {
    if (!lease.pnl) {
      return {
        pnlAmount: new Dec(0),
        pnlPercent: new Dec(0),
        pnlPositive: true,
      };
    }

    const pnlAmount = new Dec(lease.pnl.amount);
    const pnlPercent = new Dec(lease.pnl.percent);
    const pnlPositive = pnlAmount.isPositive() || pnlAmount.isZero();

    return { pnlAmount, pnlPercent, pnlPositive };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(
    lease: LeaseInfo,
    positionType: string,
    unitAsset: Dec,
    stableAsset: Dec
  ): { percent: number; price: Dec } | null {
    if (
      !lease.close_policy?.stop_loss ||
      !unitAsset.isPositive() ||
      !stableAsset.isPositive()
    ) {
      return null;
    }

    const slPercent = lease.close_policy.stop_loss / (PERMILLE / PERCENT);
    let slPrice: Dec;

    if (positionType === PositionTypes.long) {
      slPrice = stableAsset
        .quo(new Dec(lease.close_policy.stop_loss).quo(new Dec(PERMILLE)))
        .quo(unitAsset);
    } else {
      slPrice = unitAsset
        .mul(new Dec(lease.close_policy.stop_loss).quo(new Dec(PERMILLE)))
        .quo(stableAsset);
    }

    return { percent: slPercent, price: slPrice };
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(
    lease: LeaseInfo,
    positionType: string,
    unitAsset: Dec,
    stableAsset: Dec
  ): { percent: number; price: Dec } | null {
    if (
      !lease.close_policy?.take_profit ||
      !unitAsset.isPositive() ||
      !stableAsset.isPositive()
    ) {
      return null;
    }

    const tpPercent = lease.close_policy.take_profit / (PERMILLE / PERCENT);
    let tpPrice: Dec;

    if (positionType === PositionTypes.long) {
      tpPrice = stableAsset
        .quo(new Dec(lease.close_policy.take_profit).quo(new Dec(PERMILLE)))
        .quo(unitAsset);
    } else {
      tpPrice = unitAsset
        .mul(new Dec(lease.close_policy.take_profit).quo(new Dec(PERMILLE)))
        .quo(stableAsset);
    }

    return { percent: tpPercent, price: tpPrice };
  }

  /**
   * Parse interest due warning from lease
   */
  parseInterestDueWarning(lease: LeaseInfo): {
    interestDueWarning: boolean;
    interestDueDate: Date | null;
  } {
    if (!lease.overdue_collect_in) {
      return { interestDueWarning: false, interestDueDate: null };
    }

    const collectIn = BigInt(lease.overdue_collect_in);
    const interestDueWarning = collectIn <= BigInt(LEASE_DUE);
    // Convert nanoseconds to milliseconds and add to current time
    const interestDueDate = new Date(
      Date.now() + Number(collectIn / BigInt(1000000))
    );

    return { interestDueWarning, interestDueDate };
  }

  /**
   * Parse ETL data from lease
   */
  parseEtlData(
    lease: LeaseInfo,
    positionType: string,
    lpnDecimals: number
  ): {
    downPayment: Dec;
    openingPrice: Dec;
    fee: Dec;
    repaymentValue: Dec;
  } {
    const downPayment = lease.etl_data?.downpayment_amount
      ? new Dec(lease.etl_data.downpayment_amount, lpnDecimals)
      : new Dec(0);

    const openingPrice =
      positionType === PositionTypes.long
        ? new Dec(lease.etl_data?.price ?? "0")
        : new Dec(lease.etl_data?.lpn_price ?? "0");

    const fee = lease.etl_data?.fee
      ? new Dec(lease.etl_data.fee, lpnDecimals)
      : new Dec(0);

    // repayment_value from ETL is already formatted as a decimal number
    const repaymentValue = lease.etl_data?.repayment_value
      ? new Dec(lease.etl_data.repayment_value)
      : new Dec(0);

    return { downPayment, openingPrice, fee, repaymentValue };
  }

  /**
   * Parse in progress type from lease
   */
  parseInProgressType(
    lease: LeaseInfo
  ): "opening" | "repayment" | "close" | "liquidation" | "transfer_in" | null {
    if (!lease.in_progress) {
      return null;
    }

    if ("opening" in lease.in_progress) return "opening";
    if ("repayment" in lease.in_progress) return "repayment";
    if ("close" in lease.in_progress) return "close";
    if ("liquidation" in lease.in_progress) return "liquidation";
    if ("transfer_in" in lease.in_progress) return "transfer_in";

    return null;
  }

  // ============================================================================
  // Static Utility Methods
  // ============================================================================

  /**
   * Calculate total PnL across multiple leases
   */
  static calculateTotalPnl(leases: LeaseInfo[]): Dec {
    let total = new Dec(0);
    for (const lease of leases) {
      if (lease.pnl) {
        total = total.add(new Dec(lease.pnl.amount));
      }
    }
    return total;
  }

  /**
   * Calculate total debt across multiple leases
   */
  static calculateTotalDebt(leases: LeaseInfo[]): Dec {
    let total = new Dec(0);
    for (const lease of leases) {
      total = total.add(new Dec(lease.debt.total));
    }
    return total;
  }

  /**
   * Filter leases by status
   */
  static filterOpenLeases(leases: LeaseInfo[]): LeaseInfo[] {
    return leases.filter(
      (l) => l.status === "opened" || l.status === "opening"
    );
  }

  /**
   * Filter closed leases
   */
  static filterClosedLeases(leases: LeaseInfo[]): LeaseInfo[] {
    return leases.filter(
      (l) =>
        l.status === "closed" ||
        l.status === "closing" ||
        l.status === "liquidated" ||
        l.status === "paid_off"
    );
  }
}
