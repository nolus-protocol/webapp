<template>
  <div
    :class="[
      typeof this.type !== 'undefined' && this.type !== null
        ? 'picker ' + this.type
        : 'picker ',
      typeof this.isError !== 'undefined' && this.isError === true
        ? ' error'
        : '',
    ]"
  >
    <Listbox
      v-model="selected.value"
      :disabled="disabled"
      as="div"
      @update:modelValue="$emit('update-currency', selected.value)"
    >
      <div
        v-if="
          typeof this.label !== 'undefined' &&
          this.label !== null &&
          this.label.length > 0
        "
      >
        <ListboxLabel class="block text-14 nls-font-500 text-primary">
          {{ this.label }}
        </ListboxLabel>
      </div>
      <div class="mt-1 relative picker-container icon">
        <ListboxButton
          class="relative w-full background border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <span class="flex items-center">
            <img
              :src="
                require('@/assets/icons/coins/' +
                  getAssetInfo(selected.value?.balance?.denom).coinIcon)
              "
              alt=""
              class="flex-shrink-0 h-6 w-6 rounded-full"
            />
            <span class="ml-3 block truncate dark-text">
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
            <ChevronDownIcon aria-hidden="true" class="h-5 w-5 text-gray-400"/>
          </span>
        </ListboxButton>

        <span
          :class="[
            'msg error ',
            typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
              ? ''
              : 'hidden',
          ]"
        >{{
            typeof this.errorMsg !== 'undefined' && this.errorMsg !== null
              ? this.errorMsg
              : ''
          }}</span
        >

        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 w-full background shadow-lg max-h-56 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          >
            <ListboxOption
              v-for="option in this.options"
              :key="option.balance.denom"
              :value="option"
              v-slot="{ active, selected }"
              as="template"
            >
              <li
                :class="[
                  active ? 'text-white bg-indigo-600' : 'text-gray-900',
                  'cursor-default select-none relative py-2 pl-3 pr-9',
                ]"
              >
                <div class="flex items-center">
                  <img
                    :src="
                      require('@/assets/icons/coins/' +
                        getAssetInfo(option.balance.denom).coinIcon)
                    "
                    alt=""
                    class="flex-shrink-0 h-6 w-6 rounded-full"
                  />
                  <span
                    :class="[
                      selected ? 'font-semibold' : 'font-normal',
                      'ml-3 block truncate',
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
                  <CheckIcon aria-hidden="true" class="h-5 w-5"/>
                </span>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
  </div>
</template>

<script lang="ts">
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from '@headlessui/vue'
import { CheckIcon, ChevronDownIcon } from '@heroicons/vue/solid'
import { defineComponent, PropType } from 'vue'
import { AssetUtils } from '@/utils/AssetUtils'
import { AssetBalance } from '@/store/modules/wallet/state'

export default defineComponent({
  name: 'CurrencyPicker',
  components: {
    Listbox,
    ListboxButton,
    ListboxLabel,
    ListboxOption,
    ListboxOptions,
    CheckIcon,
    ChevronDownIcon
  },
  props: {
    label: {
      type: String,
      default: ''
    },
    type: {
      type: String
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
      type: Boolean
    },
    errorMsg: {
      type: String
    }
  },
  mounted () {
    this.selected.value = this.currencyOption as AssetBalance
  },
  data () {
    return {
      selected: {
        value: {} as AssetBalance
      }
    }
  },
  watch: {},
  methods: {
    getAssetInfo (denom: string) {
      return AssetUtils.getAssetInfoByAbbr(denom)
    }
  }
})
</script>
