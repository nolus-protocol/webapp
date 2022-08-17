<template>
  <div class="modal-send-receive-input-area">
    <div
      class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary">
      <span class="text-14 nls-font-500"> Available to withdraw:</span>
      <a class="text-secondary  text-14 nls-font-700 underline ml-2" href="#">
        {{ formatCurrentBalance(modelValue.selectedCurrency) }}
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
        @input="(event) => (modelValue.amount = event.target.value)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick">
      Withdraw
    </button>
  </div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'
import { CurrencyUtils } from '@nolus/nolusjs'

import CurrencyField from '@/components/CurrencyField.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import { assetsInfo } from '@/config/assetsInfo'

export interface WithdrawFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

defineProps({
  modelValue: {
    type: Object as PropType<WithdrawFormComponentProps>,
    required: true
  },
  step: {
    type: Number
  }
})

defineEmits(['update:modelValue.selectedCurrency'])

function formatCurrentBalance (selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = assetsInfo[selectedCurrency.balance.denom]
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(), selectedCurrency.balance.denom, asset.coinDenom, asset.coinDecimals
    ).toString()
  }
}
</script>
