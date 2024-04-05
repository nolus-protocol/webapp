<template>
  <div class="currency-field-container block">
    <div
      class="currency-field"
      :class="[isError === true ? 'error' : '']"
    >
      <div class="flex items-center p-2.5 p-3.5">
        <div class="inline-block w-[135px]">
          <CurrencyPicker
            :currencyOption="selectedOption"
            :options="currencyOptions"
            :disabled="false"
            @update-currency="(value) => $emit('updateCurrency', value)"
          />
        </div>
        <div class="inline-block flex-1">
          <input
            class="nls-font-700 background text-right text-18 text-primary"
            v-model="numberValue"
            autocomplete="off"
            placeholder="0"
            @keydown="inputValue"
            @keypress.space.prevent
            @paste="onPaste"
            @keyup="setValue(true)"
          />
          <span class="nls-font-400 block text-right text-14 text-light-blue">
            {{ swapBalance }}
          </span>
        </div>
      </div>

      <div class="separator m-auto w-[calc(100%-38px)]">
        <div class="arrow-box">
          <ArrowDownIcon />
        </div>
      </div>

      <div class="flex items-center p-2.5 p-3.5">
        <div class="inline-block w-[135px]">
          <CurrencyPicker
            :currencyOption="swapToOption"
            :options="currencyOptions"
            :disabled="false"
            @update-currency="(value) => $emit('updateSwapToCurrency', value)"
          />
        </div>
        <div class="inline-block flex-1">
          <input
            class="nls-font-700 background text-right text-18 text-primary"
            autocomplete="off"
            placeholder="0"
            v-model="numberSwapValue"
            @keydown="inputValue"
            @keypress.space.prevent
            @paste="onPaste"
            @keyup="setSwapValue(true)"
          />
          <span class="nls-font-400 block text-right text-14 text-light-blue">
            {{ swapToBalance }}
          </span>
        </div>
      </div>
    </div>

    <span
      class="msg error"
      :class="{ hidden: !errorMsg?.length }"
    >
      {{ errorMsg }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import type { ExternalCurrency } from "../types";
import CurrencyPicker from "./CurrencyPicker.vue";
import { computed, ref, watch } from "vue";
import { ArrowDownIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Coin, Int } from "@keplr-wallet/unit";
import { useOracleStore } from "../stores/oracle";

const oracle = useOracleStore();

interface Props {
  currencyOptions: ExternalCurrency[];
  amount: string;
  selectedOption: ExternalCurrency;
  swapToOption: ExternalCurrency;
  swapToAmount: string;
  isError: boolean;
  errorMsg: string;
}

const props = defineProps<Props>();
const dot = ".";
const minus = "-";
const comma = ",";
const allowed = ["Delete", "Backspace", "ArrowLeft", "ArrowRight", "-", ".", "Enter", "Tab", "Control", "End", "Home"];
const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const emit = defineEmits(["updateCurrency", "updateAmount", "updateSwapToCurrency", "updateSwapToAmount"]);

let numberAmount = Number(props.amount);
const numberValue = ref(props.amount);

let numberSwapAmount = Number(props.swapToAmount);
const numberSwapValue = ref(props.swapToAmount);

const swapBalance = computed(() => calculateInputBalance(props.amount, props.selectedOption));
const swapToBalance = computed(() => calculateInputBalance(props.swapToAmount, props.swapToOption));

function inputValue(event: KeyboardEvent) {
  const charCode = event.key;
  const value = numberValue.value ?? "";

  if (event.ctrlKey || event.metaKey) {
    return true;
  }

  if (event.key == minus) {
    event.preventDefault();
    return false;
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

watch(
  () => props.amount,
  () => {
    numberValue.value = props.amount;
    setValue(false);
  }
);

watch(
  () => props.swapToAmount,
  () => {
    numberSwapValue.value = props.swapToAmount;
    setSwapValue(false);
  }
);

function onPaste(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData("text");
  const num = Number(pastedText);
  if (isNaN(num)) {
    event.preventDefault();
  }
}

function setValue(isEmit = true) {
  let value = removeComma(numberValue.value ?? "");
  let numValue = Number(value);
  numberValue.value = commify(value.toString());
  if (isNaN(numValue)) {
    return false;
  }
  numberAmount = Number(value);

  if (isEmit) {
    emit("updateAmount", value);
  }
}

function setSwapValue(isEmit = true) {
  let value = removeComma(numberSwapValue.value ?? "");
  let numValue = Number(value);
  numberSwapValue.value = commify(value.toString());
  if (isNaN(numValue)) {
    return false;
  }
  numberSwapAmount = Number(value);

  if (isEmit) {
    emit("updateSwapToAmount", value);
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

function calculateInputBalance(amount: string, currency: ExternalCurrency) {
  const prices = oracle.prices;

  if (!amount || !prices) {
    return "$0";
  }

  const asset = CurrencyUtils.convertDenomToMinimalDenom(amount, currency.shortName, currency.decimal_digits);
  const coin = new Coin(currency.ibcData, new Int(String(asset.amount)));
  const tokenPrice = prices[currency.ibcData].amount;

  return CurrencyUtils.calculateBalance(tokenPrice, coin, currency.decimal_digits);
}
</script>
