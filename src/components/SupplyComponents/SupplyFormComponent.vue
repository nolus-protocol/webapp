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
import { CurrencyUtils } from '@nolus/nolusjs'

import CurrencyField from '@/components/CurrencyField.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import { assetsInfo } from '@/config/assetsInfo'
import { SupplyComponentProps } from '@/components/SupplyComponents/SupplyMainComponent.vue'

export default defineComponent({
  name: 'SupplyFormComponent',
  components: {
    CurrencyField
  },
  props: {
    modelValue: {
      type: Object as PropType<SupplyComponentProps>
    }
  },
  emits: ['update:modelValue.selectedCurrency'],
  methods: {
    formatCurrentBalance (selectedCurrency: AssetBalance) {
      if (selectedCurrency) {
        const asset = assetsInfo[selectedCurrency.balance.denom]
        return CurrencyUtils.convertMinimalDenomToDenom(
          selectedCurrency.balance.amount.toString(), selectedCurrency.balance.denom, asset.coinDenom, asset.coinDecimals
        ).toString()
      }
    }
  }
})
</script>
