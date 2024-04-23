<template>
  <div :class="[type.length > 0 ? 'picker ' + type : 'picker', isError ? ' error' : '']">
    <Listbox
      v-model="selected.value"
      v-slot="{ open }"
      as="div"
      :disabled="disabled"
      @update:modelValue="onSelect"
    >
      <div v-if="label.length > 0">
        <ListboxLabel class="nls-font-500 block text-14 text-primary">
          {{ label }}
        </ListboxLabel>
      </div>
      <div class="picker-container icon relative mt-1">
        <ListboxButton
          class="background relative cursor-default rounded-md border border-gray-300 py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
        >
          <span class="flex items-center justify-between">
            <div class="flex items-center">
              <img
                :src="selected.value?.icon"
                class="h-6 w-6 flex-shrink-0 rounded-full"
                alt=""
              />
              <span
                class="dark-text search-input !mt-0 block truncate"
                :data="selected.value?.shortName"
              >
                <input
                  class="search-input"
                  ref="searchInput"
                  v-model="value"
                  :placeholder="selected.value?.shortName"
                  :disabled="disabled"
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
            class="pointer-events-none inset-y-0 right-0 ml-[2px] mt-[2px] flex items-center"
            v-if="optionsValue!.length > 0 && !disabled"
          >
            <ChevronUpIcon
              v-if="open"
              class="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
            <ChevronDownIcon
              v-else
              class="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </span>
        </ListboxButton>

        <span
          class="msg error"
          :class="{ hidden: !errorMsg.length }"
        >
          {{ errorMsg }}
        </span>

        <transition
          name="collapse"
          appear
        >
          <ListboxOptions
            class="background scrollbar absolute top-[46px] z-10 mt-1 max-h-56 w-[125px] overflow-auto rounded-md text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
            v-if="optionsValue!.length > 0"
            @focus="searchInput?.focus()"
          >
            <ListboxOption
              v-for="option in optionsValue"
              :key="option.balance.denom"
              :value="option"
              v-slot="{ active, selected }"
              as="template"
            >
              <li
                class="dropdown-elements relative my-1 cursor-default select-none py-2 pl-3 pr-9"
                :class="{ selected: selected }"
              >
                <div class="flex items-center">
                  <img
                    :src="option.icon"
                    class="mr-3 h-6 w-6 flex-shrink-0 rounded-full"
                    alt=""
                  />
                  <span class="block truncate font-normal">
                    {{ option.shortName }}
                  </span>
                </div>

                <span
                  v-if="selected"
                  class="absolute inset-y-0 right-0 flex items-center pr-4"
                  :class="[active ? 'text-white' : 'text-indigo-600']"
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

<script setup lang="ts">
import { type PropType, ref, onMounted, watch, computed } from "vue";
import type { ExternalCurrency } from "../types";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from "@headlessui/vue";
import type { AssetBalance } from "../stores/wallet/types";
import { AssetUtils } from "../utils";
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
