<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="block mb-[13px] py-3 px-4 bg-light-grey radius-light text-left nls-14 nls-font-400 text-primary nls-font-400"
    >
      Current balance:
      <a class="text-secondary nls-font-700 underline ml-2" href="#">
        {{ formatCurrentBalance(modelValue.currentBalance) || ' 125 ETH' }}
      </a>
    </div>
    <div class="block text-left">
      <MultipleCurrencyField
        id="multiple-currency-field-example"
        label="Multiple Currency Field Example"
        name="multiple-currency-field-example" />
      <div class="flex w-full mt-[255px]">
        <div class="grow-3 text-right nls-font-500 nls-14">
          <p class="mb-3 mr-5 mt-nollus-255">Minimum received:</p>
          <p class="mb-3 mr-5">TX fee:</p>
        </div>
        <div class="text-right nls-font-700 nls-14">
          <p class="mb-3 mt-nollus-255">0.456232 ETH</p>
          <p class="mb-3">0.09233 ETH</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick">
      Swap ETH for BTC
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
import MultipleCurrencyField from '@/components/MultipleCurrencyField.vue'

export interface SwapComponentProps {
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
  name: 'SwapComponent',
  components: {
    StarIcon,
    CurrencyField,
    Picker,
    InputField,
    MultipleCurrencyField
  },
  props: {
    modelValue: {
      type: Object as PropType<SwapComponentProps>
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
