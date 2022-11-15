<template>
  <form @submit.prevent="modelValue.onNextClick">
    <div class="block text-left px-10 mt-10">
      <div
        class="block nls-balance mb-[13px] bg-light-grey radius-light text-left text-primary p-2"
      >
        {{ $t('message.outstanding-loan') }}:
        <a class="text-primary nls-font-700 ml-2">
          $36,423.02
        </a>
      </div>
      <CurrencyField
        id="repayBalance"
        name="repayBalance"
        :label="$t('message.amount-repay')"
        :value="modelValue.amount"
        :step="'1'"
        :currency-options="balances"
        :option="modelValue.selectedCurrency"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <div class="flex justify-end">
        <div class="grow-3 text-right nls-font-500 text-14">
          <p class="mb-3 mt-[25px] mr-5">{{ $t('message.repayment-amount') }}:</p>
          <p class="mb-3 mr-5">{{ $t('message.outstanding-lease') }}:</p>
          <p class="mb-3 mr-5">{{ $t('message.tx-fee') }}:</p>
        </div>
        <div class="text-right nls-font-700 text-14">
          <p class="mb-3 mt-[25px] flex justify-end align-center mr-[5px]">
            {{
              calculateBalance(
                modelValue.amount,
                modelValue.selectedCurrency?.balance?.denom
              )
            }}
          </p>
          <p class="mb-3 flex justify-end align-center mr-[5px]">
            {{
              calculateBalanceByTicker(
                modelValue.outstandingLoanAmount.amount,
                modelValue.outstandingLoanAmount.ticker
              )
            }}
          </p>
          <p class="mb-3 flex justify-end align-center mr-[5px]">
            {{
              calculateFee
            }}
          </p>
        </div>
      </div>
    </div>
    <div class="modal-send-receive-actions mt-5">
      <button
        class="btn btn-primary btn-large-primary text-center"
      >
        {{ $t('message.repay') }}
      </button>
    </div>

  </form>
</template>

<script setup lang="ts">
import CurrencyField from '@/components/CurrencyField.vue';
import type { PropType } from 'vue';
import type { RepayComponentProps } from '@/types/component/RepayComponentProps';

import { Coin, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import { useOracleStore } from '@/stores/oracle';
import { computed } from '@vue/reactivity';
import { useWalletStore } from '@/stores/wallet';
import { defaultNolusWalletFee } from '@/config/wallet';

const oracle = useOracleStore();
const wallet = useWalletStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<RepayComponentProps>,
    required: true,
  },
});

const balances = computed(() => {
  const balances = wallet.balances;
  return balances;
});

const calculateBalance = (tokenAmount: string, denom: string) => {
  const prices = oracle.prices;

  if (prices) {
    const coinPrice = prices[denom]?.amount || '0';
    const coinAmount = new Coin(denom, new Int(tokenAmount || '0'));
    return CurrencyUtils.calculateBalance(coinPrice, coinAmount, 0).toString();
  }

  return '0';
};

const calculateBalanceByTicker = (tokenAmount: string, ticker: string) => {
  const prices = oracle.prices;
  const symbol = wallet.getCurrencyByTicker(ticker).symbol;
  const denom = wallet.getIbcDenomBySymbol(symbol);
  
  if(denom){
    const coinPrice = prices[denom]?.amount ?? '0';
    const coinAmount = new Coin(denom, new Int(tokenAmount ?? '0'));
    return CurrencyUtils.calculateBalance(coinPrice, coinAmount, 0).toString();
  }

  return '0';
};

const calculateFee = computed(() => {
  const fee= defaultNolusWalletFee();
  return CurrencyUtils.convertUNolusToNolus(fee.amount[0].amount).toString();
});

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};
</script>
