<template>
  <div class="block currency-field-container">
    <label :for="id" class="flex text-14 nls-font-500 text-primary">
      {{ label }}
      <TooltipComponent v-if="tooltip.length > 0" :content="tooltip" />
    </label>
    <div
      class="currency-field p-3.5 currency-field p-3.5"
      :class="{ error: isError }"
    >
      <div class="flex items-center">
        <div class="inline-block w-1/2">
          <input
            :id="id"
            :disabled="disabledInputField"
            :name="name"
            v-model="numberValue"
            autocomplete="off"
            class="nls-font-700 text-18 text-primary background"
            @keydown="inputValue"
            @keyup="setValue"
            @paste="onPaste"
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
            @update-currency="onUpdateCurrency"
            :isLoading="isLoadingPicker"
            type="small"
          />
        </div>
      </div>
    </div>

    <span class="msg error" :class="[errorMsg.length > 0 ? '' : 'hidden']">
      {{ errorMsg.length > 0 ? errorMsg : "" }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { AssetBalance } from "@/stores/wallet/state";
import { onMounted, ref, watch, type PropType } from "vue";

import CurrencyPicker from "@/components/CurrencyPicker.vue";
import TooltipComponent from "./TooltipComponent.vue";

import { Coin, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/stores/oracle";
import { useWalletStore } from "@/stores/wallet";
import { AssetUtils } from "@/utils";

const emit = defineEmits(["update-currency", "update:modelValue", "input"]);
const oracle = useOracleStore();
const wallet = useWalletStore();

const dot = ".";
const minus = "-";
const comma = ",";
const space = " ";
const allowed = [
  "Delete",
  "Backspace",
  "ArrowLeft",
  "ArrowRight",
  "-",
  ".",
  "Enter",
  "Tab",
  "Control",
  "End",
  "Home",
];
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
  tooltip: {
    type: String,
    default: ''
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
  isLoadingPicker: {
    type: Boolean,
    default: false
  },
  isError: {
    type: Boolean,
    default: false,
  },
  errorMsg: {
    type: String,
    default: "",
  },
  positive: {
    type: Boolean,
    default: false,
  },
});

const numberValue = ref(props.value);
let numberRealValue = Number(props.value);

onMounted(() => {
  setValue();
});

watch(
  () => props.value,
  () => {
    numberValue.value = props.value;
    numberRealValue = Number(props.value);
    setValue();
  }
);

const onUpdateCurrency = (value: AssetBalance) => {
  emit("update-currency", value);
};

const calculateInputBalance = () => {
  const prices = oracle.prices;

  if (!numberRealValue || !props.option || !prices) {
    return "$0";
  }

  const ticker = props.option.ticker;

  let coinDecimals = null;
  let coinMinimalDenom = null;
  let symbol = null;

  if(ticker){
    const { decimals, symbol: currencySymbol, ibc_route   } = props.option;
    coinDecimals = decimals as number;
    coinMinimalDenom = AssetUtils.makeIBCMinimalDenom(ibc_route as string[], currencySymbol as string);
    symbol = currencySymbol as string;
  }else{
    const denom = props.option.balance.denom;
    const { coinDecimals: decimals, coinMinimalDenom: minimalDenom } = wallet.getCurrencyInfo(denom);
    symbol = wallet.currencies[denom].symbol;
    coinDecimals = decimals;
    coinMinimalDenom = minimalDenom;
  }

  const { amount } = CurrencyUtils.convertDenomToMinimalDenom(
    numberRealValue.toString(),
    coinMinimalDenom as string,
    coinDecimals
  );
  const coin = new Coin(coinMinimalDenom as string, new Int(String(amount)));
  const tokenPrice = prices[symbol]?.amount || "0";

  return CurrencyUtils.calculateBalance(tokenPrice, coin, coinDecimals);
};

const inputValue = (event: KeyboardEvent) => {
  const charCode = event.key;
  const value = numberValue.value ?? "";

  if (event.ctrlKey) {
    return true;
  }

  if (props.positive) {
    if (event.key == minus) {
      event.preventDefault();
      return false;
    }
  }

  if (charCode == minus && value.includes(minus)) {
    event.preventDefault();
    return false;
  }

  if (charCode == dot && value?.includes(dot)) {
    event.preventDefault();
    return false;
  }

  if (charCode == space) {
    event.preventDefault();
    return false;
  }

  if (allowed.includes(charCode)) {
    return true;
  }

  const num = Number(charCode);
  if (numbers.includes(num)) {
    return true;
  }

  event.preventDefault();
  return false;
};

const onPaste = (event: ClipboardEvent) => {
  const pastedText = event.clipboardData?.getData("text");
  const num = Number(pastedText);
  if (isNaN(num)) {
    event.preventDefault();
  }
};

const setValue = () => {
  let value = removeComma(numberValue.value ?? "");
  let numValue = Number(value);
  numberValue.value = commify(value.toString());
  if (isNaN(numValue)) {
    return false;
  }
  numberRealValue = Number(value);
  emit("input", value);
  emit("update:modelValue", value);
};

const commify = (n: string) => {
  const parts = n.split(".");
  const numberPart = parts[0];
  const decimalPart = parts[1];
  const hasDot = n.includes(dot);
  const thousands = /\B(?=(\d{3})+(?!\d))/g;

  return (
    numberPart.replace(thousands, comma) + (hasDot ? `.${decimalPart}` : "")
  );
};

const removeComma = (n: string) => {
  const re = new RegExp(comma, "g");
  return n.replace(re, "");
};
</script>
