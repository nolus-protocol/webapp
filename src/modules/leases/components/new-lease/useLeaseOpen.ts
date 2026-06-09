import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { tabs } from "../types";
import { usePricesStore } from "@/common/stores/prices";
import { formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { getDownpaymentRange } from "@/common/utils/LeaseConfigService";
import { MAX_POSITION, PERCENT, PERMILLE } from "@/config/global";
import { Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useI18n } from "vue-i18n";
import type { LeaseApply } from "@nolus/nolusjs/build/contracts";

// The down-payment side of the form: the asset option the user pays with. Only
// the fields the shared validators read are required; each form's `assets`
// computed produces a richer object that satisfies this structurally.
export interface DownPaymentOption {
  key: string;
  ibcData?: string;
  decimal_digits: number;
  shortName: string;
  balance?: { amount?: string };
}

// The loan side: the asset-to-lease option. The shared min/max check only needs
// its key (to resolve the per-protocol downpayment range).
export interface LoanOption {
  key: string;
}

// Infrastructure shared verbatim by LongForm and ShortForm. The divergent,
// safety-critical parts — `assets`/`coinList` building and the leaseTicker /
// leaser-protocol derivation in `calculate`/`openLease` — deliberately stay in
// each form, where the Long-vs-Short asymmetry remains visible (see the
// Short-protocol notes in the project CLAUDE.md). The validators take the
// resolved down-payment / loan options as arguments so this composable never
// needs the per-form `assets`/`coinList`.
export function useLeaseOpen() {
  const pricesStore = usePricesStore();
  const i18n = useI18n();
  const router = useRouter();

  const selectedCurrency = ref(0);
  const selectedLoanCurrency = ref(0);
  const isLoading = ref(false);
  const isDisabled = ref(false);

  const amount = ref("");
  const amountErrorMsg = ref("");
  const errorInsufficientBalance = computed(() => amountErrorMsg.value === i18n.t("message.invalid-balance-big"));
  const ltd = ref((MAX_POSITION / PERCENT) * PERMILLE);
  const leaseApply = ref<LeaseApply | null>();

  function handleAmountChange(event: string) {
    amount.value = event;
  }

  const handleParentClick = (index: number) => {
    const tab = tabs[index];
    router.push({ path: `/${RouteNames.LEASES}/open/${tab.action}` });
  };

  function onDrag(event: number) {
    const pos = new Dec(event / PERCENT);
    ltd.value = Number(pos.mul(new Dec(PERMILLE)).truncate().toString());
  }

  async function validateMinMaxValues(
    selectedDownPaymentCurrency: DownPaymentOption | undefined,
    selectedCurrency: LoanOption
  ): Promise<boolean> {
    try {
      let isValid = true;

      const downPaymentAmount = amount.value;
      const currentBalance = selectedDownPaymentCurrency;

      const [c, p] = selectedCurrency.key.split("@");
      const range = (await getDownpaymentRange(p))[c];
      if (currentBalance) {
        if (downPaymentAmount || downPaymentAmount !== "") {
          const priceData = pricesStore.prices[currentBalance.key];
          const priceAmount = priceData?.price ?? "0";

          const max = new Dec(range?.max ?? 0);
          const min = new Dec(range?.min ?? 0);

          const leaseMax = max.quo(new Dec(priceAmount));
          const leaseMin = min.quo(new Dec(priceAmount));

          const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
            downPaymentAmount,
            currentBalance.ibcData,
            currentBalance.decimal_digits
          );
          const balance = CurrencyUtils.calculateBalance(
            priceAmount,
            downPaymentAmountInMinimalDenom,
            currentBalance.decimal_digits
          ).toDec();

          if (balance.lt(min)) {
            amountErrorMsg.value = i18n.t("message.lease-min-error", {
              minAmount: formatTokenBalance(leaseMin),
              maxAmount: formatTokenBalance(leaseMax),
              symbol: currentBalance.shortName
            });
            isValid = false;
          }

          if (balance.gt(max)) {
            amountErrorMsg.value = i18n.t("message.lease-max-error", {
              minAmount: formatTokenBalance(leaseMin),
              maxAmount: formatTokenBalance(leaseMax),
              symbol: currentBalance.shortName
            });
            isValid = false;
          }
        }
      }

      return isValid;
    } catch {
      amountErrorMsg.value = i18n.t("message.integer-out-of-range");
      return false;
    }
  }

  // Balance/amount validation that must run reactively (on every input change),
  // not only on submit. The contract quote in calculate() cannot stand in for it:
  // a zero-balance collateral has no denom, so the quote attempt throws and the
  // catch surfaces a generic "Unexpected error" instead of "Insufficient balance".
  function validateAmountAgainstBalance(selectedDownPaymentCurrency: DownPaymentOption | undefined): boolean {
    const downPaymentAmount = amount.value;

    if (!selectedDownPaymentCurrency || !downPaymentAmount) {
      return true;
    }

    const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
      downPaymentAmount,
      "",
      selectedDownPaymentCurrency.decimal_digits
    );

    const isLowerThanOrEqualsToZero = new Dec(downPaymentAmountInMinimalDenom.amount || "0").lte(new Dec(0));
    const isGreaterThanWalletBalance = new Int(downPaymentAmountInMinimalDenom.amount.toString() || "0").gt(
      new Int(selectedDownPaymentCurrency?.balance?.amount ?? "0")
    );

    if (isLowerThanOrEqualsToZero) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-low");
      return false;
    }

    if (isGreaterThanWalletBalance) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-big");
      return false;
    }

    return true;
  }

  async function isDownPaymentAmountValid(
    selectedDownPaymentCurrency: DownPaymentOption | undefined,
    selectedLoan: LoanOption
  ): Promise<boolean> {
    amountErrorMsg.value = "";

    if (!amount.value) {
      amountErrorMsg.value = i18n.t("message.missing-amount");
      return false;
    }

    if (!validateAmountAgainstBalance(selectedDownPaymentCurrency)) {
      return false;
    }

    if (!(await validateMinMaxValues(selectedDownPaymentCurrency, selectedLoan))) {
      return false;
    }

    return true;
  }

  return {
    selectedCurrency,
    selectedLoanCurrency,
    isLoading,
    isDisabled,
    amount,
    amountErrorMsg,
    ltd,
    leaseApply,
    errorInsufficientBalance,
    handleAmountChange,
    handleParentClick,
    onDrag,
    validateMinMaxValues,
    validateAmountAgainstBalance,
    isDownPaymentAmountValid
  };
}
