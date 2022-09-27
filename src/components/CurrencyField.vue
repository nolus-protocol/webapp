<template>
  <div class="block currency-field-container">
    <label :for="this.id" class="block text-14 nls-font-500 text-primary">{{
        this.label
      }}</label>

    <div
      :class="[
        typeof this.isError !== 'undefined' && this.isError === true
          ? 'error'
          : '',
        'currency-field p-3.5',
      ]"
    >
      <div class="flex items-center">
        <div class="inline-block w-1/2">
          <input
            :id="this.id"
            :disabled="disabledInputField"
            :name="this.name"
            :step="this.step"
            :value="value"
            class="nls-font-700 text-18 text-primary background"
            type="number"
            @input="$emit('update:value', $event.target.value)"
          />
          <span class="block text-14 nls-font-400 text-light-blue">
            {{this.calculateInputBalance()}}
          </span>
        </div>
        <div class="inline-block w-1/2">
          <CurrencyPicker
            :currency-option="option"
            :disabled="disabledCurrencyPicker"
            :options="currencyOptions"
            type="small"
            @update-currency="onUpdateCurrency"
          />
        </div>
      </div>
    </div>

    <span
      :class="[
        'msg error ',
        typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
          ? ''
          : 'hidden',
      ]"
    >{{
        typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
          ? this.errorMsg
          : ''
      }}</span
    >
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Coin, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@nolus/nolusjs'

import CurrencyPicker from '@/components/CurrencyPicker.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import { assetsInfo } from '@/config/assetsInfo'
import { useStore } from '@/store'

export default defineComponent({
  name: 'CurrencyField',
  components: {
    CurrencyPicker
  },
  props: {
    name: {
      type: String
    },
    value: {
      type: String
    },
    currencyOptions: {
      type: Array as PropType<AssetBalance[]>
    },
    step: {
      type: String
    },
    option: {
      type: Object as PropType<AssetBalance>
    },
    id: {
      type: String
    },
    label: {
      type: String
    },
    disabledInputField: {
      type: Boolean
    },
    disabledCurrencyPicker: {
      type: Boolean
    },
    isError: {
      type: Boolean
    },
    errorMsg: {
      type: String
    }
  },
  data () {
    return {}
  },
  methods: {
    onUpdateCurrency (value: AssetBalance) {
      this.$emit('update-currency', value)
    },
    calculateInputBalance () {
      const prices = useStore().state.oracle.prices

      if (!this.value || !this.option || !prices) {
        return '$0'
      }

      const denom = this.option.balance.denom
      const { coinDecimals, coinDenom, coinMinimalDenom } = assetsInfo[denom]

      const { amount } = CurrencyUtils.convertDenomToMinimalDenom(this.value, coinMinimalDenom, coinDecimals)
      const coin = new Coin(denom, new Int(String(amount)))
      const tokenPrice = prices[coinDenom]?.amount || '0'

      return CurrencyUtils.calculateBalance(tokenPrice, coin, coinDecimals)
    }
  }
})
</script>
