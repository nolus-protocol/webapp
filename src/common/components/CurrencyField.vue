<template>
  <div class="currency-field-container block">
    <div class="flex items-center justify-between">
      <label
        :for="id"
        class="nls-font-500 data-text flex text-14"
      >
        {{ label }}
        <TooltipComponent
          v-if="tooltip.length > 0"
          :content="tooltip"
        />
      </label>
      <div
        v-if="balance"
        class="balance cursor-pointer select-none"
        @click="setBalance"
      >
        {{ $t("message.balance") }} {{ balance }}
      </div>
    </div>

    <div
      :class="{ error: isError }"
      class="currency-field currency-field p-2.5 p-3.5"
    >
      <div class="flex items-center">
        <div class="inline-block">
          <CurrencyPicker
            :currency-option="option"
            :disabled="disabledCurrencyPicker"
            :isLoading="isLoadingPicker"
            :options="currencyOptions"
            type="small"
            @update-currency="onUpdateCurrency"
          />
        </div>
        <div class="inline-block flex-1">
          <input
            :id="id"
            v-model="numberValue"
            :disabled="disabledInputField"
            :name="name"
            :placeholder="placeholder"
            autocomplete="off"
            class="nls-font-700 background text-right text-18 text-primary"
            @keydown="inputValue"
            @keyup="setValue"
            @paste="onPaste"
            @keypress.space.prevent
          />
          <span class="nls-font-400 block text-right text-14 text-light-blue">
            {{ calculateInputBalance() }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="errorMsg"
      class="repayment items-start justify-between"
    >
      <span class="msg error"> &nbsp;{{ errorMsg }} </span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { ExternalCurrency } from "@/common/types/Currecies";

import CurrencyPicker from "./CurrencyPicker.vue";
import TooltipComponent from "./TooltipComponent.vue";

import { onMounted, type PropType, ref, watch } from "vue";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { CurrencyMapping } from "@/config/currencies";
import { AssetUtils } from "../utils";

const emit = defineEmits(["update-currency", "update:modelValue", "input"]);
const oracle = useOracleStore();
const dot = ".";
const minus = "-";
const comma = ",";
const allowed = ["Delete", "Backspace", "ArrowLeft", "ArrowRight", "-", ".", "Enter", "Tab", "Control", "End", "Home"];
const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const props = defineProps({
  name: {
    type: String
  },
  value: {
    type: String
  },
  currencyOptions: {
    type: Array as PropType<ExternalCurrency[] | AssetBalance[]>
  },
  tooltip: {
    type: String,
    default: ""
  },
  option: {
    type: Object as PropType<ExternalCurrency | AssetBalance>
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
  isLoadingPicker: {
    type: Boolean,
    default: false
  },
  isError: {
    type: Boolean,
    default: false
  },
  errorMsg: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: "0"
  },
  balance: {
    type: String
  },
  total: {
    type: Object
  },
  price: {
    type: Number
  },
  positive: {
    type: Boolean,
    default: false
  }
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

function onUpdateCurrency(value: AssetBalance) {
  emit("update-currency", value);
}

function calculateInputBalance() {
  try {
    if (props.price) {
      const coin = CurrencyUtils.convertDenomToMinimalDenom(
        numberRealValue.toString(),
        props.option?.balance.denom as string,
        props.option?.decimal_digits as number
      );
      return CurrencyUtils.calculateBalance(props.price.toString(), coin, props.option?.decimal_digits as number);
    }

    const prices = oracle.prices;
    let coinDecimals = null;
    let coinMinimalDenom = null;
    if (!numberRealValue || !props.option || !prices) {
      return "$0";
    }

    if ((props.option as ExternalCurrency).ticker) {
      let [ticker, protocol] = (props.option as ExternalCurrency).ticker.split("@");

      if (CurrencyMapping[ticker]) {
        ticker = CurrencyMapping[ticker].ticker;
      }
      const currency = AssetUtils.getCurrencyByTicker(ticker);
      coinDecimals = Number(currency?.decimal_digits);
      coinMinimalDenom = currency?.ibcData;
    } else {
      const currency = AssetUtils.getCurrencyByDenom(props.option.balance.denom);
      coinDecimals = Number(currency?.decimal_digits);
      coinMinimalDenom = currency?.ibcData;
    }

    const { amount } = CurrencyUtils.convertDenomToMinimalDenom(
      numberRealValue.toString(),
      coinMinimalDenom as string,
      coinDecimals
    );

    const coin = new Coin(props.option.balance.denom as string, new Int(String(amount)));
    const tokenPrice = prices[coinMinimalDenom!]?.amount || "0";
    return CurrencyUtils.calculateBalance(tokenPrice, coin, coinDecimals);
  } catch (error) {
    return "$0.00";
  }
}

function inputValue(event: KeyboardEvent) {
  const charCode = event.key;
  const value = numberValue.value ?? "";

  if (event.ctrlKey || event.metaKey) {
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

  if (allowed.includes(charCode)) {
    return true;
  }

  const num = Number(charCode);
  if (numbers.includes(num)) {
    return true;
  }

  event.preventDefault();
  return false;
}

function onPaste(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData("text");
  const num = Number(pastedText);
  if (isNaN(num)) {
    event.preventDefault();
  }
}

function setValue() {
  let value = removeComma(numberValue.value ?? "");
  let numValue = Number(value);
  numberValue.value = commify(value.toString());
  if (isNaN(numValue)) {
    return false;
  }
  numberRealValue = Number(value);
  emit("input", value);
  emit("update:modelValue", value);
}

function setBalance() {
  if (props.total) {
    let decimals = props.option!.decimal_digits;

    if (!decimals) {
      const currency = AssetUtils.getCurrencyByDenom(props.total.denom);
      decimals = currency.decimal_digits;
    }

    const value = new Dec(props.total.amount, decimals);
    emit("input", value.toString(decimals));
    emit("update:modelValue", value.toString(decimals));
  }
}

function commify(n: string) {
  const parts = n.split(".");
  const numberPart = parts[0];
  const decimalPart = parts[1];
  const hasDot = n.includes(dot);
  const thousands = /\B(?=(\d{3})+(?!\d))/g;

  return numberPart.replace(thousands, comma) + (hasDot ? `.${decimalPart}` : "");
}

function removeComma(n: string) {
  const re = new RegExp(comma, "g");
  return n.replace(re, "");
}
</script>
