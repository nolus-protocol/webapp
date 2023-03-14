<template>
  <div
    :class="[
      type.length > 0 ? 'picker ' + type : 'picker ',
      isError ? ' error' : '',
    ]"
  >
    <Listbox
      v-model="selected"
      v-slot="{ open }"
      as="div"
      :disabled="disabled"
      @update:modelValue="$emit('update-selected', selected)"
    >
      <ListboxLabel class="block text-14 nls-font-500 text-primary">
        {{ label }}
      </ListboxLabel>
      <div class="mt-1 relative picker-container">
        <ListboxButton
        class="relative w-full background border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <span class="flex items-center">
            <img
              v-if="selected.icon"
              :src="selected.icon"
              alt=""
              class="mr-3 flex-shrink-0 h-6 w-6 rounded-full"
            />
            <span class="block truncate dark-text">{{ selected.label }}</span>
          </span>
          <span
            class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"
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

        <span class="msg error" :class="[errorMsg.length > 0 ? '' : 'hidden']">
          {{ errorMsg.length > 0 ? errorMsg : "" }}
        </span>

        <transition
          name="collapse"
          appear
        >
          <ListboxOptions
            class="absolute z-10 mt-1 w-full background shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm scrollbar"
          >
            <ListboxOption
              v-for="option in options"
              :key="option.value"
              :value="option"
              as="template"
              v-slot="{ active, selected }"
            >
              <li
                class="cursor-default select-none relative py-2 pl-3 pr-9 dropdown-elements"
                :class="[
                  active ? 'text-white bg-indigo-600' : 'text-gray-900',
                  selected ? 'selected' : '',
                ]"
              >
                <div class="flex items-center">
                  <img
                    v-if="option.icon"
                    :src="option.icon"
                    alt=""
                    class="mr-3 flex-shrink-0 h-6 w-6 rounded-full"
                  />
                  <span class="block truncate font-normal">
                    {{ option.label }}
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
import { onMounted, ref, watch, type PropType } from "vue";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";

import {
  Listbox,
  ListboxButton,
  ListboxLabel,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";

export interface PickerOption {
  id?: string;
  label: string;
  value: string;
  icon?: string;
}

const props = defineProps({
  label: {
    type: String,
  },
  type: {
    type: String,
    default: "",
  },
  defaultOption: {
    type: Object as PropType<PickerOption>,
    required: true,
  },
  options: {
    type: Array as PropType<PickerOption[]>,
  },
  isError: {
    type: Boolean,
    default: false,
  },
  errorMsg: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
  },
});

const selected = ref({} as PickerOption);

onMounted(() => {
  setValue(props.defaultOption);
});

watch(
  () => props.defaultOption,
  (value: PickerOption, b: PickerOption) => {
    setValue(props.defaultOption);
  }
);

const setValue = (option: PickerOption) => {
  for (const item of props.options ?? []) {
    if (item.value == option.value) {
      selected.value = item;
      break;
    }
  }
};
</script>
