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
      v-model="selected"
      :disabled="disabled"
      as="div"
      @update:modelValue="$emit('update-selected', selected)"
    >
      <ListboxLabel class="block nls-14 nls-font-500 text-primary">
        {{ label }}
      </ListboxLabel>
      <div class="mt-1 relative picker-container">
        <ListboxButton
          class="bg-white relative w-full border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <span class="block truncate">{{ selected.label }}</span>
          <span
            class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
          >
            <ChevronDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
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
            typeof this.errorMsg !== "undefined" && this.errorMsg !== null
              ? this.errorMsg
              : ""
          }}</span
        >

        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm"
          >
            <ListboxOption
              v-for="option in this.options"
              :key="option.value"
              v-slot="{ active, selected }"
              :value="option"
              as="template"
            >
              <li
                :class="[
                  active ? 'text-white bg-indigo-600' : 'text-gray-900',
                  'cursor-default select-none relative py-2 pl-3 pr-9',
                ]"
              >
                <span
                  :class="[
                    selected ? 'font-semibold' : 'font-normal',
                    'block truncate',
                  ]"
                >
                  {{ option.label }}
                </span>

                <span
                  v-if="selected"
                  :class="[
                    active ? 'text-white' : 'text-indigo-600',
                    'absolute inset-y-0 right-0 flex items-center pr-4',
                  ]"
                >
                  <CheckIcon class="h-5 w-5" aria-hidden="true" />
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
import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { CheckIcon, ChevronDownIcon } from "@heroicons/vue/solid";
import { defineComponent, PropType } from "vue";

export interface PickerDefaultOption {
  id?: string;
  label: string;
  value: string;
}

export default defineComponent({
  name: "PickerDefault",
  components: {
    Listbox,
    ListboxButton,
    ListboxLabel,
    ListboxOption,
    ListboxOptions,
    CheckIcon,
    ChevronDownIcon,
  },
  props: {
    label: {
      type: String,
    },
    type: {
      type: String,
    },
    defaultOption: {
      type: Object as PropType<PickerDefaultOption>,
    },
    options: {
      type: Array as PropType<PickerDefaultOption[]>,
    },
    isError: {
      type: Boolean,
    },
    errorMsg: {
      type: String,
    },
    disabled: {
      type: Boolean,
    },
  },
  mounted() {
    console.log("mounted picker: ", this.defaultOption);
    this.selected = this.defaultOption as PickerDefaultOption;
  },
  watch: {
    defaultOption() {
      this.selected = this.defaultOption as PickerDefaultOption;
    },
  },
  data() {
    return {
      selected: {} as PickerDefaultOption,
    };
  },
});
</script>
