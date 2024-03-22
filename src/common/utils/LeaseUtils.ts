import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { LeaseAttributes } from "../types/LeaseData";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { LPN_DECIMALS, PERCENT, PERMILLE } from "@/config/global";
import { AppUtils, AssetUtils, EtlApi, Logger } from ".";
import { CurrencyDemapping } from "@/config/currencies";

export class LeaseUtils {
  public static calculateLiquidation(unit: Dec, price: Dec) {
    return unit.quo(price).quo(new Dec(0.9));
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

        return item;
      }

      const downpaymentTicker = result.lease.LS_cltr_symbol;
      const downPaymentCurrency = AssetUtils.getCurrencyByTicker(
        CurrencyDemapping[downpaymentTicker]?.ticker ?? downpaymentTicker
      );

      const leasePositionStable = new Dec(result.lease.LS_loan_amnt_asset, LPN_DECIMALS);
      const downPayment = new Dec(result.lease.LS_cltr_amnt_stable, Number(downPaymentCurrency!.decimal_digits));
      const positionSize = leasePositionStable.add(downPayment);
      const fee = (await AppUtils.getSwapFee())[result.lease.LS_asset_symbol as string] ?? 0;
      const downPaymentFee = positionSize.quo(new Dec(1 - fee)).sub(positionSize);

      return {
        downPaymentFee,
        downPayment,
        downpaymentTicker: result.lease.LS_cltr_symbol,
        leasePositionTicker: result.lease.LS_asset_symbol,
        leasePositionStable: leasePositionStable,
        timestamp: new Date(result.lease.LS_timestamp),
        price: new Dec(result.downpayment_price)
      };
    } catch (error) {
      Logger.error(error);
    }
  }
}
