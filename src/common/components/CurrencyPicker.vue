<template>
  <div :class="[type.length > 0 ? 'picker ' + type : 'picker', isError ? 'error' : '']">
    <Listbox
      v-slot="{ open }"
      v-model="selected.value"
      :disabled="disabled"
      as="div"
      @update:modelValue="onSelect"
    >
      <div v-if="label.length > 0">
        <ListboxLabel class="block text-14 font-medium text-neutral-typography-200">
          {{ label }}
        </ListboxLabel>
      </div>
      <div class="picker-container icon relative mt-1">
        <ListboxButton
          class="background shadow-sm relative flex w-full cursor-default !items-center rounded-md border border-gray-300 py-2 pl-3 pr-10 text-left focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
        >
          <span class="flex items-center justify-between">
            <div class="flex items-center">
              <img
                v-if="value.length == 0"
                :src="selected.value?.icon"
                alt=""
                class="h-6 w-6 flex-shrink-0 rounded-full"
              />
              <span
                :data="selected.value?.shortName"
                class="dark-text search-input !mt-0 block truncate !leading-normal"
              >
                <input
                  ref="searchInput"
                  v-model="value"
                  :disabled="disabled"
                  :placeholder="selected.value?.shortName"
                  class="search-input"
                  @focusout="focusOut"
                />
              </span>
            </div>
            <span
              v-if="isLoading"
              class="loading mr-[4px]"
            >
            </span>
          </span>
          <span
            v-if="optionsValue!.length > 0 && !disabled"
            class="pointer-events-none inset-y-0 right-0 ml-[2px] mt-[2px] flex items-center"
          >
            <ChevronUpIcon
              v-if="open"
              aria-hidden="true"
              class="h-5 w-5 text-gray-400"
            />
            <ChevronDownIcon
              v-else
              aria-hidden="true"
              class="h-5 w-5 text-gray-400"
            />
          </span>
        </ListboxButton>

        <span
          :class="{ hidden: !errorMsg.length }"
          class="msg error"
        >
          {{ errorMsg }}
        </span>

        <transition
          appear
          name="collapse"
        >
          <ListboxOptions
            v-if="optionsValue!.length > 0"
            class="background scrollbar shadow-lg absolute top-[46px] z-10 mt-1 max-h-56 w-[125px] overflow-auto rounded-md text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
            @focus="searchInput?.focus()"
          >
            <ListboxOption
              v-for="option in optionsValue"
              :key="option.balance.denom"
              v-slot="{ active, selected }"
              :value="option"
              as="template"
            >
              <li
                :class="{ selected: selected }"
                class="dropdown-elements relative my-1 cursor-default select-none py-2 pl-3 pr-9"
              >
                <div class="flex items-center">
                  <img
                    :src="option.icon"
                    alt=""
                    class="mr-3 h-6 w-6 flex-shrink-0 rounded-full"
                  />
                  <span class="block truncate font-normal">
                    {{ option.shortName }}
                  </span>
                </div>

                <span
                  v-if="selected"
                  :class="[active ? 'text-white' : 'text-indigo-600']"
                  class="absolute inset-y-0 right-0 flex items-center pr-4"
                >
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
  </div>
</template>

<script lang="ts" setup>
import { type PropType, ref, onMounted, watch, computed } from "vue";
import type { ExternalCurrency } from "../types";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from "@headlessui/vue";
import type { AssetBalance } from "../stores/wallet/types";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "../stores/oracle";
import { Coin } from "@keplr-wallet/unit";

const searchInput = ref<HTMLInputElement>();
const value = ref("");

const props = defineProps({
  label: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    default: ""
  },
  options: {
    type: Array as PropType<ExternalCurrency[] | AssetBalance[]>
  },
  currencyOption: {
    type: Object as PropType<ExternalCurrency | AssetBalance>
  },
  disabled: {
    type: Boolean
  },
  isError: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  disablePicker: {
    type: Boolean
  },
  errorMsg: {
    type: String,
    default: ""
  }
});

const selected = ref({
  value: {} as ExternalCurrency | AssetBalance
});

const emit = defineEmits(["update-currency"]);
const oracle = useOracleStore();

const optionsValue = computed(() => {
  const i = items() ?? [];
  i.sort((a, b) => {
    const aAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[a.balance.denom]?.amount,
      new Coin(a.balance.denom, a.balance.amount.toString()),
      a.decimal_digits as number
    ).toDec();

    const bAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[b.balance.denom]?.amount,
      new Coin(b.balance.denom, b.balance.amount.toString()),
      b.decimal_digits as number
    ).toDec();

    return Number(bAssetBalance.sub(aAssetBalance).toString(8));
  });
  return i;
});

function items() {
  if (props.disablePicker) {
    return (props.options ?? [])?.filter((item) => {
      if (item.balance.denom == props.currencyOption?.balance.denom) {
        return false;
      }
      return true;
    });
  }

  const v = value.value.toLowerCase();

  const items = (props.options ?? [])?.filter((item) => {
    const name = item.shortName?.toLocaleLowerCase() ?? "";
    if (name.includes(v)) {
      return true;
    }
    return false;
  });

  if (items.length > 0) {
    return items;
  }

  return props.options;
}

function focusOut() {
  setTimeout(() => {
    value.value = "";
  }, 200);
}

watch(
  () => props.currencyOption,
  () => {
    selected.value.value = props.currencyOption!;
  }
);

onMounted(() => {
  selected.value.value = props.currencyOption!;
});

function onSelect(v: ExternalCurrency | AssetBalance) {
  value.value = "";
  emit("update-currency", v);
}
</script>
