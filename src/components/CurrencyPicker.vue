<template>
  <div
    :class="[
      type !== null ? 'picker ' + type : 'picker',
      isError === true ? ' error' : '',
    ]"
  >
    <Listbox
      v-model="selected.value"
      :disabled="disabled"
      as="div"
      @update:modelValue="$emit('update-currency', selected.value)"
      v-slot="{open}"
    >
      <div v-if="label.length > 0">
        <ListboxLabel class="block text-14 nls-font-500 text-primary">
          {{ label }}
        </ListboxLabel>
      </div>
      <div class="mt-1 relative picker-container icon">
        <ListboxButton
          class="relative w-full background border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <span class="flex items-center">
            <img
              :src="getAssetInfo(selected.value?.balance?.denom)?.coinIcon"
              alt=""
              class="flex-shrink-0 h-6 w-6 rounded-full"
            />
            <span class="block truncate dark-text">
              {{
                getAssetInfo(
                  selected.value?.balance?.denom
                ).coinAbbreviation.toUpperCase()
              }}
            </span>
          </span>
          <span
            class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
          >
          <ChevronUpIcon  v-if="open"  class="h-5 w-5 text-gray-400" aria-hidden="true" />
          <ChevronDownIcon v-else class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </ListboxButton>

        <span :class="['msg error ', errorMsg.length > 0 ? '' : 'hidden']">{{
          errorMsg.length > 0 ? errorMsg : ""
        }}</span>

        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 background shadow-lg max-h-56 w-[125px] rounded-md text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm top-[46px] scrollbar"
          >
            <ListboxOption
              v-for="option in options"
              :key="option.balance.denom"
              :value="option"
              v-slot="{ active, selected }"
              as="template"
            >
              <li
                :class="[
                  selected ? 'bg-[#EBEFF5]' : '',
                  'cursor-default select-none relative py-2 pl-3 pr-9 dropdown-elements my-1',
                ]"
              >
                <div class="flex items-center">
                  <img
                    :src="getAssetInfo(option.balance.denom).coinIcon"
                    alt=""
                    class="flex-shrink-0 h-6 w-6 rounded-full mr-3"
                  />
                  <span
                    :class="[
                      'block truncate font-normal',
                    ]"
                  >
                    {{
                      getAssetInfo(
                        option.balance.denom
                      ).coinAbbreviation.toUpperCase()
                    }}
                  </span>
                </div>

                <span
                  v-if="selected"
                  :class="[
                    active ? 'text-white' : 'text-indigo-600',
                    'absolute inset-y-0 right-0 flex items-center pr-4',
                  ]"
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
import type { AssetBalance } from '@/stores/wallet/state';
import { type PropType, ref, onMounted } from 'vue';

import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from '@headlessui/vue';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/solid';
import { useWalletStore } from '@/stores/wallet';
import { DEFAULT_ASSET } from '@/config/env';

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    default: null,
  },
  options: {
    type: Array as PropType<AssetBalance[]>,
  },
  currencyOption: {
    type: Object as PropType<AssetBalance>,
  },
  disabled: {
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

const wallet = useWalletStore();

const getAssetInfo = (denom: string) => {
  return wallet.getCurrencyInfo(denom ?? DEFAULT_ASSET.denom);
};

const selected = ref({
  value: {} as AssetBalance,
});

onMounted(() => {
  selected.value.value = props.currencyOption as AssetBalance;
});
</script>
<style scoped lang="scss">
.scrollbar{
  scrollbar-width: thin;
  scrollbar-color: #9c9c9c #f5f5f5;

  &::-webkit-scrollbar-track {
    background-color: white;
  }

  &::-webkit-scrollbar {
    width: 8px;
    height: 6px;
    background-color: white;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #EBEFF5;
    border: solid 1px white;
    border-radius: 5px;
  }
}
</style>
