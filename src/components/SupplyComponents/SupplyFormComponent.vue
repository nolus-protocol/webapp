<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
    >
      <span class="text-14 nls-font-500">Current APR:</span>
      <span class="text-14 nls-font-700  ml-2"> {{ modelValue.currentAPR}}</span>
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

      <WarningBox :isWarning="true" class="mt-[25px]">
        <template v-slot:icon>
         <img class="block mx-auto my-0 w-10 h-10" src="@/assets/icons/diamond-o.svg"/>
        </template>
        <template v-slot:content>
          <span>Rewards will compound automatically over the initially supplied amount</span>
        </template>
      </WarningBox>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick"
    >
      Supply
    </button>
  </div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'

import CurrencyField from '@/components/CurrencyField.vue'
import WarningBox from '@/components/modals/templates/WarningBox.vue'
import { AssetBalance } from '@/store/modules/wallet/state'

export interface SupplyFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  currentAPR: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

  defineProps({
    modelValue: {
      type: Object as PropType<SupplyFormComponentProps>,
      required: true
    },
    step: {
      type: Number
    }
  })

  defineEmits(['update:modelValue.selectedCurrency'])
</script>
