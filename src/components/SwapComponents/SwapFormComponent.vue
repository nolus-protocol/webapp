<template>
  <div class="modal-send-receive-input-area">
    <div
      class="block mb-[13px] py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
    >
      Balance:
      <a class="text-secondary nls-font-700 underline ml-2" href="#">
        {{ formatCurrentBalance(selectedCurrency) }}
      </a>
    </div>
    <div class="block text-left">
      <MultipleCurrencyField
        :amount="amount"
        :currencyOptions="currentBalance"
        :selectedOption="selectedCurrency"
        :swapToOption="swapToSelectedCurrency"
        :isError="!!errorMsg"
        :errorMsg="errorMsg"
        @updateCurrency="(value: AssetBalance) => $emit('updateSelected', value)"
        @updateSwapToCurrency="(value: AssetBalance) => $emit('updateSwapToSelected', value)"
        @updateAmount="(value: string) => $emit('updateAmount', value)"
      />
      <div class="flex w-full mt-[25px]">
        <!-- @TODO: Implement -->
        <div class="grow-3 text-right nls-font-500 text-14">
          <p class="mb-3 mr-5 mt-nollus-255">Minimum received:</p>
          <p class="mb-3 mr-5">TX fee:</p>
        </div>
        <div class="text-right nls-font-700 text-14">
          <p class="mb-3 mt-nollus-255">0.456232 ETH</p>
          <p class="mb-3">0.09233 ETH</p>
        </div>
      </div>
    </div>
  </div>

  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="onSwapClick">
      {{ `Swap ${coinAbbr} for ${swapToCoinAbbr}` }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { defineProps, defineEmits, computed } from 'vue'
import { CurrencyUtils } from '@nolus/nolusjs'

import { AssetBalance } from '@/store/modules/wallet/state'
import MultipleCurrencyField from '@/components/MultipleCurrencyField.vue'
import { assetsInfo } from '@/config/assetsInfo'
import { AssetUtils } from '@/utils/AssetUtils'

interface Props {
  selectedCurrency: AssetBalance
  swapToSelectedCurrency: AssetBalance
  currentBalance: AssetBalance[]
  amount: string
  onSwapClick: () => void
  errorMsg: string
}

const props = defineProps<Props>()
defineEmits(['updateSelected', 'updateAmount', 'updateSwapToSelected'])

const coinAbbr = computed(() => AssetUtils.getAssetInfoByAbbr(props.selectedCurrency.balance.denom).coinAbbreviation.toUpperCase())
const swapToCoinAbbr = computed(() => AssetUtils.getAssetInfoByAbbr(props.swapToSelectedCurrency.balance.denom).coinAbbreviation.toUpperCase())

function formatCurrentBalance (selectedCurrency: AssetBalance) {
    if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
      const asset = assetsInfo[selectedCurrency.balance.denom]
      return CurrencyUtils.convertMinimalDenomToDenom(
        selectedCurrency.balance.amount.toString(), selectedCurrency.balance.denom, asset.coinDenom, asset.coinDecimals
      ).toString()
    }
  }

</script>
