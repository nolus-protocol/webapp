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
            autocomplete="off" class="nls-font-700 text-18 text-primary background" 
            @keydown="inputValue"
            @keyup="setValue"
            ref="textInputField" />
          <input type="number" ref="numberInputField" v-model="numberValue" />
          <span class="block text-14 nls-font-400 text-light-blue">
            <!-- {{ calculateInputBalance() }} -->
          </span>
        </div>
        <div class="inline-block w-1/2">
          <CurrencyPicker :currency-option="option" :disabled="disabledCurrencyPicker" :options="currencyOptions"
            type="small" @update-currency="onUpdateCurrency" />
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
import { computed, ref, type PropType } from 'vue';

import CurrencyPicker from '@/components/CurrencyPicker.vue';

import { Coin, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import { useOracleStore } from '@/stores/oracle';
import { useWalletStore } from '@/stores/wallet';

const emit = defineEmits(['update-currency', 'update:modelValue']);
const oracle = useOracleStore();
const wallet = useWalletStore();
const textInputField = ref<HTMLInputElement>();
const numberInputField = ref<HTMLInputElement>();

const dot = '.';
const minus = '-';
const comma = ',';
const allowed = ['Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', '-', '.', 'Enter', 'Tab']
const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

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
  positive: {
    type: Boolean,
    default: false
  }
});

const numberValue = ref(Number(props.value))
const parseValue = computed(() => {
  if (numberValue.value == 0) {
    return '';
  }
  let amount = commify(numberValue.value);
  return amount;
})

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

const inputValue = (event: KeyboardEvent) => {
  const charCode = event.key;
  const field = textInputField.value;
  const value = field?.value ?? '';

  if (props.positive) {
    if (event.key == minus) {
      event.preventDefault()
      return false;
    }
  }

  if (charCode == minus && value.length > 0) {
    event.preventDefault()
    return false;
  }

  if (charCode == dot && value?.includes(dot)) {
    event.preventDefault()
    return false;
  }

  if (allowed.includes(charCode)) {
    return true;
  }

  const num = Number(charCode);

  if (numbers.includes(num)) {
    return true;
  }

  event.preventDefault()
  return false;

}

const setValue = (event: KeyboardEvent) => {
  const field = textInputField.value;
  const value = field?.value ?? '';
}

const commify = (n: number) => {
  const parts = n.toString().split('.');
  const numberPart = parts[0];
  const decimalPart = parts[1];
  const thousands = /\B(?=(\d{3})+(?!\d))/g;
  return numberPart.replace(thousands, comma) + (decimalPart ? '.' + decimalPart : '');
}

const removeComma = (n: string) => {
  return n.replace(comma, '');
}

const handleInputChange = (event: Event) => (event.target as HTMLInputElement).value;
</script>
