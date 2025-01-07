<template>
  <AdvancedFormControl
    id="swap-1"
    :currencyOptions="currencyOptions"
    :selectedCurrencyOption="selectedFirstCurrencyOption"
    class="px-6 py-4"
    label="From"
    :balanceLabel="`${$t('message.balance')}:`"
    placeholder="0"
    :calculatedBalance="firstCalculatedBalance"
    @on-selected-currency="(option) => onUpdateCurrency(option, Emitters.onFirstChange)"
    @input="onUpdateFirstValue"
    :disabledCurrencyPicker="disabled"
    :disabledInputField="disabled"
    :isLoadingPicker="isLoading"
    :itemsHeadline="itemsHeadline"
    :item-template="itemTemplate"
    :valueOnly="firstInputValue"
    searchable
  />
  <div class="relative">
    <hr class="border-border-color" />
    <button
      :class="[{ '-top-5': swapSvg }]"
      class="button-secondary transform-all ease-bounce ease-bounce absolute -top-[22px] left-1/2 h-11 w-11 -translate-x-1/2 cursor-pointer rounded-full px-2 duration-300 hover:h-12 hover:w-12"
      @click="onSwap"
      @mouseleave="swapSvg = false"
      @mouseover="swapSvg = true"
    >
      <div class="relative flex h-full w-full items-center justify-center">
        <Swap
          :class="[{ 'rotate-180 opacity-100': swapSvg }]"
          class="ease-bounce transform-all absolute stroke-icon-default opacity-0 duration-300"
        />
        <DownArrow
          :class="[{ 'rotate-180 opacity-0': swapSvg }]"
          class="ease-bounce transform-all absolute stroke-icon-default duration-300"
        />
      </div>
    </button>
  </div>
  <AdvancedFormControl
    id="swap-2"
    :currencyOptions="currencyOptions"
    :selectedCurrencyOption="selectedSecondCurrencyOption"
    :disabledCurrencyPicker="disabled"
    :disabledInputField="disabled"
    class="px-6 py-4"
    label="To"
    hideBalance
    placeholder="0"
    :calculatedBalance="secondCalculatedBalance"
    @on-selected-currency="(option) => onUpdateCurrency(option, Emitters.onSecondChange)"
    @input="onUpdateSecondValue"
    :isLoadingPicker="isLoading"
    :itemsHeadline="itemsHeadline"
    :item-template="itemTemplate"
    :valueOnly="secondInputValue"
    searchable
  />
  <span
    :class="{ hidden: !errorMsg?.length }"
    class="px-6 py-4 text-14 text-typography-error"
  >
    {{ errorMsg }}
  </span>
</template>

<script lang="ts" setup>
import { ref, watch, type Component } from "vue";
import { type AdvancedCurrencyFieldOption, AdvancedFormControl } from "web-components";
import DownArrow from "@/common/components/icons/down-arrow.vue";
import Swap from "@/common/components/icons/swap.vue";
import { MultipleCurrencyEventType } from "../types";

enum Emitters {
  onFirstChange = "on-first-change",
  onSecondChange = "on-second-change"
}

const emit = defineEmits([Emitters.onFirstChange, Emitters.onSecondChange]);

const props = defineProps<{
  firstInputValue?: string;
  secondInputValue?: string;
  firstCalculatedBalance?: string;
  secondCalculatedBalance?: string;
  selectedFirstCurrencyOption: AdvancedCurrencyFieldOption | undefined;
  selectedSecondCurrencyOption: AdvancedCurrencyFieldOption | undefined;
  currencyOptions: AdvancedCurrencyFieldOption[];
  errorMsg?: string;
  disabled?: boolean;
  isLoading?: boolean;
  itemsHeadline?: string[];
  itemTemplate?: (item: any) => Component;
  onSwap?: (e: Event) => void;
}>();

const swapSvg = ref(false);
const firstValue = ref(props.firstInputValue);
const secondValue = ref(props.secondInputValue);

const onUpdateCurrency = (currency: AdvancedCurrencyFieldOption, emitter: Emitters) => {
  switch (emitter) {
    case Emitters.onFirstChange: {
      emitOnChange(currency, firstValue.value, emitter, MultipleCurrencyEventType.select);
      break;
    }
    case Emitters.onSecondChange: {
      emitOnChange(currency, secondValue.value, emitter, MultipleCurrencyEventType.select);
      break;
    }
  }
};

const emitOnChange = (
  currency: AdvancedCurrencyFieldOption | undefined,
  value: string | undefined,
  emitter: Emitters,
  type: MultipleCurrencyEventType
) => {
  switch (emitter) {
    case Emitters.onFirstChange: {
      emit(emitter, {
        currency: currency ?? props.selectedFirstCurrencyOption,
        input: { value: value ?? firstValue.value, order: emitter },
        type
      });
      break;
    }
    case Emitters.onSecondChange: {
      emit(emitter, {
        currency: currency ?? props.selectedSecondCurrencyOption,
        input: { value: value ?? secondValue.value, order: emitter },
        type
      });
      break;
    }
  }
};

function onUpdateFirstValue(value: string) {
  firstValue.value = value;
  emitOnChange(undefined, value, Emitters.onFirstChange, MultipleCurrencyEventType.input);
}

function onUpdateSecondValue(value: string) {
  secondValue.value = value;
  emitOnChange(undefined, value, Emitters.onSecondChange, MultipleCurrencyEventType.input);
}

watch(
  () => props.firstInputValue,
  (value) => {
    firstValue.value = value;
  }
);

watch(
  () => props.secondInputValue,
  (value) => {
    secondValue.value = value;
  }
);
</script>

<style scoped lang=""></style>
