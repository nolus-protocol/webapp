<template>
  <div class="block currency-field-container">
    <label :for="id" class="block text-14 nls-font-500 text-primary">
      {{ label }}
    </label>
    <div :class="[isError === true ? 'error' : '', 'currency-field p-3.5']">
      <div class="flex items-center">
        <div class="inline-block w-1/2">
          <input
            :id="id"
            :disabled="disabledInputField"
            :name="name"
            :step="step"
            :value="value"
            class="nls-font-700 text-18 text-primary background"
            type="number"
            @input="$emit('update:modelValue', handleInputChange($event))"
          />
          <span class="block text-14 nls-font-400 text-light-blue">
            {{ calculateInputBalance() }}
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

    <span :class="['msg error ', errorMsg.length > 0 ? '' : 'hidden']">
    {{ errorMsg.length > 0 ? errorMsg : "" }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { AssetBalance } from '@/stores/wallet/state';
import type { PropType } from 'vue';

import CurrencyPicker from '@/components/CurrencyPicker.vue';

import { Coin, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import { useOracleStore } from '@/stores/oracle';
import { useWalletStore } from '@/stores/wallet';

const emit = defineEmits(['update-currency', 'update:modelValue']);
const oracle = useOracleStore();
const wallet = useWalletStore();

const props = defineProps({
  name: {
    type: String,
  },
  value: {
    type: String,
  },
  currencyOptions: {
    type: Array as PropType<AssetBalance[]>,
  },
  step: {
    type: String,
  },
  option: {
    type: Object as PropType<AssetBalance>,
  },
  id: {
    type: String,
  },
  label: {
    type: String,
  },
  disabledInputField: {
    type: Boolean,
  },
  disabledCurrencyPicker: {
    type: Boolean,
  },
  isError: {
    type: Boolean,
    default: false,
  },
  errorMsg: {
    type: String,
    default: '',
  },
});

const onUpdateCurrency = (value: AssetBalance) => {
  emit('update-currency', value);
};

const calculateInputBalance = () => {
  const prices = oracle.prices;

  if (!props.value || !props.option || !prices) {
    return '$0';
  }

  const denom = props.option.balance.denom;
  const { coinDecimals, coinMinimalDenom } = wallet.getCurrencyInfo(denom);
  const symbol = wallet.currencies[denom].symbol;

  const { amount } = CurrencyUtils.convertDenomToMinimalDenom(
    props.value,
    coinMinimalDenom,
    coinDecimals
  );
  const coin = new Coin(denom, new Int(String(amount)));
  const tokenPrice = prices[symbol]?.amount || '0';

  return CurrencyUtils.calculateBalance(tokenPrice, coin, coinDecimals);
};

const handleInputChange = (event: Event) => (event.target as HTMLInputElement).value;
</script>
