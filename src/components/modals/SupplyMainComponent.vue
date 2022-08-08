<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
    >
      <span class="text-14 nls-font-500">Expected APY:</span>
      <span class="text-14 nls-font-700  ml-2"> 24%</span>
      <TooltipComponent content="Content goes here"/>
    </div>

    <div class="block text-left mt-nolus-16">
      <CurrencyField id="amountSupply" label="Amount" name="amountSupply"/>
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

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { CurrencyUtils } from '@nolus/nolusjs'

import CurrencyField from '@/components/CurrencyField.vue'
import Picker from '@/components/Picker.vue'
import InputField from '@/components/InputField.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import TooltipComponent from '@/components/TooltipComponent.vue'

export interface SupplyComponentProps {
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

export default defineComponent({
  name: 'SupplyComponent',
  components: {
    StarIcon,
    CurrencyField,
    Picker,
    InputField,
    TooltipComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<SupplyComponentProps>
    }
  },
  methods: {
    formatCurrentBalance (value: AssetBalance[]) {
      if (value) {
        return CurrencyUtils.convertUNolusToNolus(
          value[0]?.balance.amount.toString()
        ).toString()
      }
    },
    onUpdateCurrency (value: AssetBalance) {
      this.$emit('update:modelValue.selectedCurrency', value)
    }
  }
})
</script>
