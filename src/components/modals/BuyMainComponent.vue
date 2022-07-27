<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <WarningBox :isWarning="true">
      <template v-slot:icon>
        <i class="icon icon-tooltip"></i>
      </template>
      <template v-slot:content>
        Send only <span class="nls-font-700">WBTC</span> to this deposit
        address. Ensure the network is
        <span class="nls-font-700">Ethereum (ERC20)</span>
      </template>
    </WarningBox>
    <div class="block text-left">
      <MultipleCurrencyField
        id="multiple-currency-field-example"
        label="Multiple Currency Field Example"
        name="multiple-currency-field-example"
      ></MultipleCurrencyField>
      <div class="flex w-full mt-[255px]">
        <div class="grow-3 text-right nls-font-500 nls-14">
          <p class="mb-3 mr-5">1 BTC price in USD::</p>
          <p class="mb-3 mr-5">Ramp fee:</p>
          <p class="mr-5">Network fees:</p>
        </div>
        <div class="text-right nls-font-700 nls-14">
          <p class="mb-3">$37,274.98</p>
          <p class="mb-3">-$2.49</p>
          <p>-$0.09233</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick"
    >
      Buy BTC with USD
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
import MultipleCurrencyField from '@/components/MultipleCurrencyField.vue'
import WarningBox from '@/components/modals/templates/WarningBox.vue'

export interface SendComponentProps {
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
  name: 'BuyComponent',
  components: {
    StarIcon,
    CurrencyField,
    Picker,
    InputField,
    TooltipComponent,
    MultipleCurrencyField,
    WarningBox
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>
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
