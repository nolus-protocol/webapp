import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { LeaseAttributes } from "../types/LeaseData";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { AssetUtils, EtlApi, Logger } from ".";
import { CurrencyDemapping } from "@/config/currencies";
import { useApplicationStore } from "../stores/application";

export class LeaseUtils {
  public static calculateLiquidation(unit: Dec, price: Dec) {
    return unit.quo(price).quo(new Dec(0.9));
  }

  public static calculateLiquidationShort(unit: Dec, price: Dec) {
    return unit.mul(new Dec(0.9)).quo(price);
  }
  public static calculateAditionalDebt(principal: Dec, percent: Dec) {
    const annualAmount = principal.mul(percent);
    const secondsAmount = annualAmount.quo(new Dec(31536000));
    const amountForTwoMinuts = secondsAmount.mul(new Dec(180));
    return amountForTwoMinuts;
  }

  public static getDebt(data: OpenedLeaseInfo | undefined) {
    if (data) {
      const item = AssetUtils.getCurrencyByTicker(data.principal_due.ticker!);
      const amount = new Dec(data.principal_due.amount)
        .add(new Dec(data.overdue_margin.amount))
        .add(new Dec(data.overdue_interest.amount))
        .add(new Dec(data.due_margin.amount))
        .add(new Dec(data.due_interest.amount))
        .add(LeaseUtils.additionalInterest(data).roundUpDec());

      const token = CurrencyUtils.convertMinimalDenomToDenom(
        amount.truncate().toString(),
        item.ibcData,
        item!.symbol,
        Number(item!.decimal_digits)
      );
      return token.toDec();
    }

    return new Dec("0");
  }

  public static additionalInterest(data: OpenedLeaseInfo | null) {
    if (data) {
      const principal_due = new Dec(data.principal_due.amount);
      const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(
        new Dec(data.margin_interest_rate / PERCENT)
      );
      const debt = LeaseUtils.calculateAditionalDebt(principal_due, loanInterest);

      return debt;
    }

    return new Dec(0);
  }

  public static async getLeaseData(leaseAddress: string): Promise<LeaseAttributes | undefined> {
    try {
      const result = await EtlApi.fetchLeaseOpening(leaseAddress);

      if (!result) {
        const item = JSON.parse(localStorage.getItem(leaseAddress) ?? "{}");
        item.timestamp = new Date();

        item.downPayment = new Dec(0);
        item.leasePositionStable = new Dec(0);
        item.price = new Dec(0);
        item.downPaymentFee = new Dec(0);
        item.lpnPrice = new Dec(0);

        return item;
      }

      const downpaymentTicker = result.lease.LS_cltr_symbol;
      const downPaymentCurrency = AssetUtils.getCurrencyByTicker(
        CurrencyDemapping[downpaymentTicker]?.ticker ?? downpaymentTicker
      );

      const contract = AssetUtils.getProtocolByContract(result.lease.LS_loan_pool_id);
      const lpn = AssetUtils.getLpnByProtocol(contract);
      let leasePositionTicker = result.lease.LS_asset_symbol;

      switch (ProtocolsConfig[contract].type) {
        case PositionTypes.short: {
          leasePositionTicker = CurrencyDemapping[lpn.ticker]?.ticker ?? lpn.ticker;
          break;
        }
      }

      const leasePositionStable = new Dec(result.lease.LS_loan_amnt_asset, lpn.decimal_digits);
      const downPayment = new Dec(result.lease.LS_cltr_amnt_stable, Number(downPaymentCurrency!.decimal_digits));
      const app = useApplicationStore();
      const ctrl_asset_ticker = CurrencyDemapping[result.lease.LS_cltr_symbol]?.ticker ?? result.lease.LS_cltr_symbol;

      const ctrl_currency = app.currenciesData![`${ctrl_asset_ticker}@${contract}`];
      const ls_asset_symbol = CurrencyDemapping[result.lease.LS_asset_symbol]?.ticker ?? result.lease.LS_asset_symbol;
      const lease_currency = app.currenciesData![`${ls_asset_symbol}@${contract}`];

      const ctrl_asset = new Dec(result.lease.LS_cltr_amnt_stable, ctrl_currency.decimal_digits);
      const loan = new Dec(result.lease.LS_loan_amnt_stable, lpn.decimal_digits);
      const total = ctrl_asset.add(loan);
      const loan_amnt_stable = new Dec(result.lease.LS_lpn_loan_amnt, lease_currency.decimal_digits).mul(
        new Dec(result.lpn_price)
      );
      const downPaymentFee = total.sub(loan_amnt_stable);

      return {
        downPaymentFee,
        downPayment,
        downpaymentTicker: result.lease.LS_cltr_symbol,
        leasePositionTicker,
        leasePositionStable: leasePositionStable,
        timestamp: new Date(result.lease.LS_timestamp),
        price: new Dec(result.downpayment_price),
        lpnPrice: new Dec(result.lpn_price),
        ls_asset_symbol: result.lease.LS_asset_symbol
      };
    } catch (error) {
      Logger.error(error);
    }
  }
}
