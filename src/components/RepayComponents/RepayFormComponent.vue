<template>
  <div class="block text-left px-10 mt-10">
    <div
      class="block nls-balance mb-[13px] bg-light-grey radius-light text-left text-primary"
    >
      {{ $t('message.current-balance') }}:
      <a class="text-secondary nls-font-700 underline ml-2" href="#">
        $36,423.02
      </a>
    </div>
    <CurrencyField
      id="repayBalance"
      label="Balance To Repay"
      name="repayBalance"
      :value="modelValue.amount"
      :step="'1'"
      @input="handleAmountChange($event)"
      :currency-options="balances"
      :option="modelValue.selectedCurrency"
      @update-currency="(event) => (modelValue.selectedCurrency = event)"
      :error-msg="modelValue.amountErrorMsg"
      :is-error="modelValue.amountErrorMsg !== ''"
    />
    <div class="flex w-full">
      <div class="grow-3 text-right nls-font-500 text-14">
        <p class="mb-3 mt-[25px] mr-5">{{ $t('message.repayment-amount') }}:</p>
        <p class="mb-3 mr-5">{{ $t('message.outstanding-lease') }}:</p>
      </div>
      <div class="text-right nls-font-700 text-14">
        <p class="mb-3 mt-[25px] flex justify-end align-center mr-[5px]">
          {{
            calculateBalance(
              modelValue.amount,
              modelValue.selectedCurrency?.balance?.denom
            )
          }}
          <TooltipComponent content="Content goes here " />
        </p>
        <p class="mb-3 flex justify-end align-center mr-[5px]">
          {{
            calculateBalance(
              modelValue.outstandingLoanAmount.amount,
              modelValue.outstandingLoanAmount.symbol
            )
          }}
          <TooltipComponent content="Content goes here" />
        </p>
      </div>
    </div>
  </div>
  <div class="modal-send-receive-actions mt-5">
    <button
      class="btn btn-primary btn-large-primary text-center"
      @click="modelValue.onNextClick"
    >
      {{ $t('message.repay') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import CurrencyField from '@/components/CurrencyField.vue';
import TooltipComponent from '@/components/TooltipComponent.vue';
import type { PropType } from 'vue';

import type { RepayComponentProps } from '@/types/component/RepayComponentProps';
import { Coin, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import { useOracleStore } from '@/stores/oracle';
import { computed } from '@vue/reactivity';
import { LPP_CONSTANTS } from '@/config/contracts';
import { EnvNetworkUtils } from '@/utils';

const oracle = useOracleStore();

const props = defineProps({
  modelValue: {
    type: Object as PropType<RepayComponentProps>,
    required: true,
  },
});

const balances = computed(() => {
  const balances = props.modelValue.currentBalance;
  const lpp_coins = LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()];
  return balances.filter((item) => lpp_coins[item.balance.denom] );
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

const handleAmountChange = (event: Event) => {
  props.modelValue.amount = (event.target as HTMLInputElement).value;
};
</script>
