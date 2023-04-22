<template>
  <form @submit.prevent="modelValue.onNextClick"
        class="w-full">
    <div class="block text-left px-10 mt-10 py-[5px]">
      <div class="block py-3 px-4 modal-balance radius-light text-left text-14 nls-font-400 text-primary mb-4">
        {{ $t('message.balance') }}:
        <a class="text-secondary nls-font-700 underline ml-2 cursor-pointer"
           @click.stop="setAmount">
          {{ formatCurrentBalance(modelValue.selectedCurrency) }}
        </a>
      </div>
      <CurrencyField id="repayBalance"
                     name="repayBalance"
                     :label="$t('message.amount-field')"
                     :value="modelValue.amount"
                     :currency-options="modelValue.currentBalance"
                     :option="modelValue.selectedCurrency"
                     :error-msg="modelValue.amountErrorMsg"
                     :is-error="modelValue.amountErrorMsg !== ''"
                     @input="handleAmountChange($event)"
                     @update-currency="(event) => (modelValue.selectedCurrency = event)" />
      <div class="repayment">
        <button v-for="value in REPAYMENT_VALUES"
                type="button"
                :key="value"
                @click="setRepayment(value)">
          {{ value }}%
        </button>
      </div>
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
            <!-- {{
              calculateBalance(
                modelValue.amount,
                modelValue.selectedCurrency?.balance?.denom
              )
            }} -->
            <TooltipComponent :content="$t('message.outstanding-debt-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            ${{ calucateAfterRepayment }}
            <!-- {{
              calculateBalanceByTicker(
                modelValue.outstandingLoanAmount.amount,
                modelValue.outstandingLoanAmount.ticker
              )
            }} -->
          </p>
        </div>
      </div>
    </div>
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary text-center">
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
import { ADDITIONAL_OUTSTANDING_DEBT, NATIVE_NETWORK, REPAYMENT_VALUES } from "@/config/env";

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
    const amount = new Dec(data.principal_due.amount)
      .add(new Dec(data.previous_margin_due.amount))
      .add(new Dec(data.previous_interest_due.amount))
      .add(new Dec(data.current_margin_due.amount))
      .add(new Dec(data.current_interest_due.amount))

    const percent = new Dec(ADDITIONAL_OUTSTANDING_DEBT);
    return amount.mul(percent);
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
    .add(additionalInterest())

  return debt;
}

const calucateAfterRepayment = computed(() => {

  if (props.modelValue.amount && props.modelValue.amount != "") {
    const data = props.modelValue.leaseInfo;
    const currencyDebt = wallet.getCurrencyByTicker(data.principal_due.ticker);
    const debtDenom = wallet.getIbcDenomBySymbol(currencyDebt.symbol);
    const info = wallet.getCurrencyInfo(debtDenom as string);

    const debt = new Dec(data.principal_due.amount)
      .add(new Dec(data.previous_margin_due.amount))
      .add(new Dec(data.previous_interest_due.amount))
      .add(new Dec(data.current_margin_due.amount))
      .add(new Dec(data.current_interest_due.amount))
      .add(additionalInterest())

    const debtCoin = CurrencyUtils.convertMinimalDenomToDenom(
      debt.toString(),
      info.coinMinimalDenom as string,
      info.coinDenom as string,
      info.coinDecimals
    ).toDec();

    const amountDenom = props.modelValue.selectedCurrency.balance.denom;
    const amountCurrency = wallet.getCurrencyInfo(amountDenom);
    const asset = wallet.getCurrencyByTicker(amountCurrency.ticker);
    const price = oracle.prices[asset.symbol];
    const amountDecimals = Number(asset.decimal_digits);
    const balaceAmount = CurrencyUtils.convertDenomToMinimalDenom(props.modelValue.amount, amountDenom, amountDecimals);

    const amountInUSD = CurrencyUtils.calculateBalance(price.amount, balaceAmount, Number(asset.decimal_digits)).toDec();

    const amount = debtCoin.sub(amountInUSD);

    if (amount.isNegative()) {
      return "0";
    }

    return amount.toString(amountDecimals);

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

const setAmount = () => {
  const asset = wallet.getCurrencyInfo(
    props.modelValue.selectedCurrency.balance.denom
  );
  const data = CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.selectedCurrency.balance.amount.toString(),
    props.modelValue.selectedCurrency.balance.denom,
    asset.coinDenom,
    asset.coinDecimals
  );
  props.modelValue.amount = Number(data.toDec().toString()).toString();

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

  props.modelValue.amount = repayment.toString(selectedCurrencyInfo.coinDecimals);

}
</script>
