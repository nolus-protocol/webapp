import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import { Dec } from "@keplr-wallet/unit";
import { PERCENT, PERMILLE } from "@/config/global";

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
}
