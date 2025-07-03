import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { LeaseAttributes } from "../types/LeaseData";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { AssetUtils, EtlApi } from ".";
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

  public static async getLeaseData(leaseAddress: string): Promise<LeaseAttributes> {
    try {
      const result = await EtlApi.fetchLeaseOpening(leaseAddress);

      if (!result) {
        const item = {
          timestamp: new Date(),
          downPayment: new Dec(0),
          leasePositionStable: new Dec(0),
          price: new Dec(0),
          downPaymentFee: new Dec(0),
          lpnPrice: new Dec(0),
          fee: new Dec(0),
          pnlAmount: new Dec(0),
          repayment_value: new Dec(0)
        };

        return item;
      }

      const downpaymentTicker = result.lease.LS_cltr_symbol;
      const downPaymentCurrency = AssetUtils.getCurrencyByTicker(downpaymentTicker);

      const contract = AssetUtils.getProtocolByContract(result.lease.LS_loan_pool_id);
      const lpn = AssetUtils.getLpnByProtocol(contract);
      let leasePositionTicker = result.lease.LS_asset_symbol;
      let l_c = result.lease.LS_asset_symbol;

      switch (ProtocolsConfig[contract].type) {
        case PositionTypes.short: {
          leasePositionTicker = lpn.ticker;
          break;
        }
      }

      const leasePositionStable = new Dec(result.lease.LS_loan_amnt_asset, lpn.decimal_digits);
      const downPayment = new Dec(result.lease.LS_cltr_amnt_stable, Number(downPaymentCurrency!.decimal_digits));
      const app = useApplicationStore();
      const currency = app.currenciesData![`${l_c}@${contract}`];

      return {
        history: result?.history ?? [],
        pnlAmount: new Dec(result.pnl, currency.decimal_digits),
        fee: new Dec(result.fee, currency.decimal_digits),
        downPayment,
        downpaymentTicker: result.lease.LS_cltr_symbol,
        leasePositionTicker,
        leasePositionStable: leasePositionStable,
        timestamp: new Date(result.lease.LS_timestamp),
        price: new Dec(result.downpayment_price),
        lpnPrice: new Dec(result.lpn_price),
        ls_asset_symbol: result.lease.LS_asset_symbol,
        repayment_value: new Dec(result.repayment_value)
      };
    } catch (error) {
      throw error;
    }
  }
}
