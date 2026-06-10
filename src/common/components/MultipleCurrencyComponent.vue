<template>
  <AdvancedFormControl
    id="swap-1"
    :currencyOptions="currencyOptions"
    class="px-6 py-4"
    label="From"
    :balanceLabel="`${$t('message.balance')}:`"
    placeholder="0"
    @on-selected-currency="(option) => onUpdateCurrency(option, Emitters.onFirstChange)"
    @input="onUpdateFirstValue"
    :disabledCurrencyPicker="disabled"
    :disabledInputField="disabled"
    :isLoadingPicker="isLoading"
    v-bind="firstControlBind"
    searchable
  />
  <div class="relative">
    <hr class="border-border-color" />
    <button
      :class="[{ '-top-5': swapSvg }]"
      class="button-secondary transform-all ease-bounce ease-bounce absolute -top-[22px] left-1/2 h-11 w-11 -translate-x-1/2 cursor-pointer rounded-full px-2 duration-300 hover:h-12 hover:w-12"
      @click="onSwap?.($event)"
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
    :disabledCurrencyPicker="disabled"
    :disabledInputField="disabled"
    class="px-6 py-4"
    label="To"
    hideBalance
    placeholder="0"
    @on-selected-currency="(option) => onUpdateCurrency(option, Emitters.onSecondChange)"
    @input="onUpdateSecondValue"
    :isLoadingPicker="isLoading"
    v-bind="secondControlBind"
    searchable
  />
  <AnimatePresence>
    <Motion
      v-if="errorMsg?.length"
      :initial="{ opacity: 0, y: 4, overflow: 'hidden' }"
      :animate="{ opacity: 1, y: 0, overflow: 'hidden', transition: { type: 'spring', stiffness: 400, damping: 20 } }"
      :exit="{ opacity: 0, y: 4, overflow: 'hidden', transition: { type: 'spring', stiffness: 400, damping: 40 } }"
      tag="div"
      class="flex items-center gap-1 px-6 py-4 text-14 text-typography-error"
    >
      <SvgIcon
        size="s"
        name="warning"
        class="fill-typography-error"
      />
      <AnimatePresence mode="wait">
        <Motion
          :key="errorMsg"
          :initial="{ opacity: 0, y: 4 }"
          :animate="{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 20 } }"
          :exit="{ opacity: 0, y: 4, transition: { type: 'spring', stiffness: 400, damping: 40 } }"
          tag="span"
          >{{ errorMsg }}</Motion
        >
      </AnimatePresence>
    </Motion>
  </AnimatePresence>
</template>

<script lang="ts" setup>
import { computed, ref, watch, type Component } from "vue";
import { type AdvancedCurrencyFieldOption, AdvancedFormControl, SvgIcon } from "web-components";
import { AnimatePresence, Motion } from "motion-v";
import DownArrow from "@/common/components/icons/DownArrow.vue";
import Swap from "@/common/components/icons/Swap.vue";
import { MultipleCurrencyEventType } from "../types";

enum Emitters {
  onFirstChange = "on-first-change",
  onSecondChange = "on-second-change"
}

const emit = defineEmits(["on-first-change", "on-second-change"]);

const props = defineProps<{
  firstInputValue?: string;
  secondInputValue?: string;
  firstCalculatedBalance?: string;
  secondCalculatedBalance?: string;
  selectedFirstCurrencyOption: AdvancedCurrencyFieldOption | undefined;
  selectedSecondCurrencyOption: AdvancedCurrencyFieldOption | undefined;
  currencyOptions: AdvancedCurrencyFieldOption[];
  errorMsg?: string;
  errorInsufficientBalance?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  itemsHeadline?: string[];
  itemTemplate?: (item: AdvancedCurrencyFieldOption) => Component;
  onSwap?: (e: Event) => void;
}>();

const swapSvg = ref(false);
const firstValue = ref(props.firstInputValue);
const secondValue = ref(props.secondInputValue);

// Adapter for AdvancedFormControl's `(option?: DropdownOption) => any` template
// prop. The required-but-widened parameter keeps the wrapper's arity at 1 — the
// dropdown gates custom-item rendering on `itemTemplate.length`.
const itemTemplateForControl = computed(() => {
  const template = props.itemTemplate;
  if (template === undefined) {
    return undefined;
  }
  return (option: AdvancedCurrencyFieldOption | undefined) => {
    if (option === undefined) {
      console.error("[MultipleCurrencyComponent] item template invoked without an option");
      return undefined;
    }
    return template(option);
  };
});

// exactOptionalPropertyTypes: AdvancedFormControl's optional props don't accept
// an explicit undefined, so possibly-absent bindings are spread in only when set.
interface AdvancedControlBind {
  selectedCurrencyOption?: AdvancedCurrencyFieldOption;
  calculatedBalance?: string;
  valueOnly?: string;
  itemsHeadline?: string[];
  itemTemplate?: (option: AdvancedCurrencyFieldOption | undefined) => Component | undefined;
  inputClass?: string;
}

function buildControlBind(
  selected: AdvancedCurrencyFieldOption | undefined,
  calculatedBalance: string | undefined,
  valueOnly: string | undefined
): AdvancedControlBind {
  const bind: AdvancedControlBind = {};
  if (selected !== undefined) {
    bind.selectedCurrencyOption = selected;
  }
  if (calculatedBalance !== undefined) {
    bind.calculatedBalance = calculatedBalance;
  }
  if (valueOnly !== undefined) {
    bind.valueOnly = valueOnly;
  }
  if (props.itemsHeadline !== undefined) {
    bind.itemsHeadline = props.itemsHeadline;
  }
  const template = itemTemplateForControl.value;
  if (template !== undefined) {
    bind.itemTemplate = template;
  }
  if (props.errorInsufficientBalance) {
    bind.inputClass = "text-typography-error";
  }
  return bind;
}

const firstControlBind = computed(() =>
  buildControlBind(props.selectedFirstCurrencyOption, props.firstCalculatedBalance, props.firstInputValue)
);
const secondControlBind = computed(() =>
  buildControlBind(props.selectedSecondCurrencyOption, props.secondCalculatedBalance, props.secondInputValue)
);

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
