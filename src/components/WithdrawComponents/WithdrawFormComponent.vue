<template>
  <div class="modal-send-receive-input-area">
    <div
      class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
    >
      <span class="text-14 nls-font-500"> Available to withdraw:</span>
      <a class="text-secondary text-14 nls-font-700 underline ml-2" href="#">
        {{ formatCurrentBalance(modelValue.currentDepositBalance) }}
      </a>
    </div>
    <div class="block text-left mt-[25px]">
      <CurrencyField
        id="amountSupply"
        :currency-options="modelValue.currentBalance"
        :disabled-currency-picker="false"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :option="modelValue.selectedCurrency"
        :value="modelValue.amount"
        label="Amount"
        name="amountSupply"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      @click="modelValue.onNextClick"
    >
      {{ $t('message.withdraw') }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import CurrencyField from '@/components/CurrencyField.vue';

import type { AssetBalance } from '@/stores/wallet/state';
import type { WithdrawFormComponentProps } from '@/types/component/WithdrawFormComponentProps';
import type { PropType } from 'vue';
import { CurrencyUtils } from '@nolus/nolusjs';
import { assetsInfo } from '@/config/assetsInfo';

const props = defineProps({
  modelValue: {
    type: Object as PropType<WithdrawFormComponentProps>,
    required: true,
  },
});

defineEmits(['update:modelValue.selectedCurrency']);

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = assetsInfo[selectedCurrency.balance.denom];
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
}

const handleAmountChange = (event: Event) => {
  props.modelValue.amount = (event.target as HTMLInputElement).value;
};
</script>
