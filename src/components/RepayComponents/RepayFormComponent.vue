<template>
  <form
    @submit.prevent="modelValue.onNextClick"
    class="w-full"
  >
    <div class="block text-left px-10 mt-10 py-[5px]">
      <CurrencyField
        id="repayBalance"
        name="repayBalance"
        :label="$t('message.amount-field')"
        :value="modelValue.amount"
        :currency-options="modelValue.currentBalance"
        :option="modelValue.selectedCurrency"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :balance="formatCurrentBalance(modelValue.selectedCurrency)"
        :set-input-value="setRepayment"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <div class="flex justify-end">
        <div class="grow-3 text-right nls-font-500 text-14 dark-text">
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.repayment-amount") }}:
          </p>
          <p class="mb-2 mt-[14px] mr-5">{{ $t("message.outstanding-lease") }}:</p>
        </div>
        <div class="text-right nls-font-700 text-14">
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            ${{ calculateOutstandingDebt() }}
            <TooltipComponent :content="$t('message.outstanding-debt-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            ${{ calucateAfterRepayment }}
          </p>
        </div>
      </div>
    </div>
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary text-center plausible-event-name=repay">
        {{ $t("message.repay") }}
      </button>
      <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import CurrencyField from "@/components/CurrencyField.vue";
import TooltipComponent from "../TooltipComponent.vue";

import type { RepayComponentProps } from "@/types/component/RepayComponentProps";
import type { AssetBalance } from "@/stores/wallet/state";
import { type PropType, computed } from "vue";

import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/stores/oracle";
import { useWalletStore } from "@/stores/wallet";
import { NATIVE_NETWORK, PERMILLE, PERCENT, SWAP_FEE } from "@/config/env";
import { calculateAditionalDebt } from "@/config/env";

const oracle = useOracleStore();
const wallet = useWalletStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<RepayComponentProps>,
    required: true,
  },
});

const calculateOutstandingDebt = () => {
  const data = props.modelValue.leaseInfo;
  const currency = wallet.getCurrencyByTicker(data.principal_due.ticker);
  const denom = wallet.getIbcDenomBySymbol(currency.symbol);
  const info = wallet.getCurrencyInfo(denom as string);
  const debt = outStandingDebt();

  if (denom) {

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      debt.truncate().toString(),
      info.coinMinimalDenom as string,
      info.coinDenom as string,
      info.coinDecimals
    );

    return token.hideDenom(true).toString();
  }

  return "0";
}

const additionalInterest = () => {
  const data = props.modelValue.leaseInfo;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount)
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0)
}


const outStandingDebt = () => {
  const data = props.modelValue.leaseInfo;

  const debt = new Dec(data.principal_due.amount)
    .add(new Dec(data.previous_margin_due.amount))
    .add(new Dec(data.previous_interest_due.amount))
    .add(new Dec(data.current_margin_due.amount))
    .add(new Dec(data.current_interest_due.amount))
    .add(additionalInterest().roundUpDec())

  return debt.add(debt.mul(new Dec(SWAP_FEE)));
}

const calucateAfterRepayment = computed(() => {

  if (props.modelValue.amount && props.modelValue.amount != "") {
    const amount = outStandingDebt();
    const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.principal_due.ticker);
    const denom = wallet.getIbcDenomBySymbol(currency.symbol);
    const info = wallet.getCurrencyInfo(denom as string);
    const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(amount.toString(), info.coinMinimalDenom, info.coinDenom, info.coinDecimals).toDec();

    const selectedCurrencyInfo = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom as string);
    const selectedCurrency = wallet.getCurrencyByTicker(selectedCurrencyInfo.ticker);
    const price = new Dec(oracle.prices[selectedCurrency.symbol].amount);

    const repayment = new Dec(props.modelValue.amount).mul(price);
    const diff = amountToRepay.sub(repayment);
    
    if (diff.isNegative()) {
      return "0";
    }

    return diff.toString(info.coinDecimals);

  }

  return "0";

});

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(
      selectedCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
};

const setRepayment = (p: number) => {
  const amount = outStandingDebt();
  const currency = wallet.getCurrencyByTicker(props.modelValue.leaseInfo.principal_due.ticker);
  const denom = wallet.getIbcDenomBySymbol(currency.symbol);
  const info = wallet.getCurrencyInfo(denom as string);
  const amountToRepay = CurrencyUtils.convertMinimalDenomToDenom(amount.toString(), info.coinMinimalDenom, info.coinDenom, info.coinDecimals).toDec();

  const percent = new Dec(p).quo(new Dec(100));
  const repaymentInStable = amountToRepay.mul(percent);

  const selectedCurrencyInfo = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom as string);
  const selectedCurrency = wallet.getCurrencyByTicker(selectedCurrencyInfo.ticker);
  const price = new Dec(oracle.prices[selectedCurrency.symbol].amount);
  const repayment = repaymentInStable.quo(price);

  props.modelValue.amount = repayment.toString(selectedCurrencyInfo.coinDecimals + 1);

}
</script>
