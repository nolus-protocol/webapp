<template>
  <div :class="[type.length > 0 ? 'picker ' + type : 'picker', isError ? ' error' : '']">
    <Listbox
      v-model="selected.value"
      v-slot="{ open }"
      as="div"
      :disabled="disabled"
      @update:modelValue="$emit('update-currency', selected.value)"
    >
      <div v-if="label.length > 0">
        <ListboxLabel class="nls-font-500 block text-14 text-primary">
          {{ label }}
        </ListboxLabel>
      </div>
      <div class="picker-container icon relative mt-1">
        <ListboxButton
          class="background relative w-full cursor-default rounded-md border border-gray-300 py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
        >
          <span class="flex items-center">
            <img
              :src="selected.value?.icon ?? getAssetInfo(selected.value?.balance?.denom)?.icon"
              class="h-6 w-6 flex-shrink-0 rounded-full"
              alt=""
            />
            <span class="dark-text block truncate">
              {{ selected.value?.shortName ?? getAssetInfo(selected.value?.balance?.denom).shortName }}
            </span>
            <span
              v-if="isLoading"
              class="loading"
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
                    :src="option.icon ?? getAssetInfo(option.balance.denom).icon"
                    class="mr-3 h-6 w-6 flex-shrink-0 rounded-full"
                    alt=""
                  />
                  <span class="block truncate font-normal">
                    {{ option.name ?? getAssetInfo(option.balance.denom).shortName }}
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
import type { AssetBalance } from "@/common/stores/wallet/types";
import { type PropType, ref, onMounted, watch, computed } from "vue";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import { NATIVE_ASSET } from "@/config/global";
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { AssetUtils } from "../utils";

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
    type: Array as PropType<AssetBalance[]>
  },
  currencyOption: {
    type: Object as PropType<AssetBalance>
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
  value: {} as AssetBalance
});

const optionsValue = computed(() => {
  if (props.disablePicker) {
    return (props.options ?? [])?.filter((item) => {
      if (item.balance.denom == props.currencyOption?.balance.denom) {
        return false;
      }
      return true;
    });
  }

  return props.options;
});

onMounted(() => {
  selected.value.value = props.currencyOption as AssetBalance;
});

watch(
  () => props.currencyOption,
  () => {
    selected.value.value = props.currencyOption as AssetBalance;
  }
);

function getAssetInfo(denom: string) {
  return AssetUtils.getCurrencyByDenom(denom ?? NATIVE_ASSET.denom);
}
</script>
