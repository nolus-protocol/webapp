<template>
  <div :class="[type.length > 0 ? 'picker ' + type : 'picker ', isError ? ' error' : '']">
    <Listbox
      v-slot="{ open }"
      v-model="selected"
      :disabled="disabled"
      as="div"
      @update:modelValue="onSelect"
    >
      <ListboxLabel class="data-text block text-14">
        {{ label }}
      </ListboxLabel>
      <div class="picker-container relative mt-[4px]">
        <ListboxButton
          class="background relative flex w-full cursor-default !items-center rounded-md border border-gray-300 py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
        >
          <span class="flex items-center">
            <img
              v-if="selected.icon && value.length == 0"
              :src="selected.icon"
              alt=""
              class="mr-3 h-6 w-6 flex-shrink-0 rounded-full"
            />
            <span
              class="dark-text search-input !mt-0 block truncate !leading-normal"
              :data="selected.label"
            >
              <input
                class="search-input"
                ref="searchInput"
                v-model="value"
                :placeholder="selected.label"
                :disabled="disabled || disableInput"
                @focusout="focusOut"
              />
            </span>
          </span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
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
            @focus="searchInput?.focus()"
            class="background scrollbar absolute z-10 mt-1 max-h-60 max-h-[160px] w-full overflow-auto rounded-md py-1 text-base shadow-lg focus:outline-none sm:text-sm"
          >
            <ListboxOption
              v-for="option in optionsValue"
              :key="option.value"
              v-slot="{ active, selected }"
              :value="option"
              as="template"
            >
              <li
                :class="[active ? 'bg-indigo-600 text-white' : 'text-gray-900', selected ? 'selected' : '']"
                class="dropdown-elements relative cursor-default select-none py-2 pl-3 pr-9"
              >
                <div class="flex items-center">
                  <img
                    v-if="option.icon"
                    :src="option.icon"
                    alt=""
                    class="mr-3 h-6 w-6 flex-shrink-0 rounded-full"
                  />
                  <span class="block truncate font-normal">
                    {{ option.label }}
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
import { onMounted, type PropType, ref, watch } from "vue";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/vue/24/solid";
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { computed } from "vue";
import type { ExternalCurrency } from "../types";
import type { AssetBalance } from "../stores/wallet/types";

export interface PickerOption {
  id?: string;
  label: string;
  value: string;
  icon?: string;
  ticker?: string;
  key?: string;
}
const searchInput = ref<HTMLInputElement>();
const value = ref("");

const props = defineProps({
  label: {
    type: String
  },
  type: {
    type: String,
    default: ""
  },
  defaultOption: {
    type: Object as PropType<PickerOption>,
    required: true
  },
  options: {
    type: Array as PropType<PickerOption[]>
  },
  isError: {
    type: Boolean,
    default: false
  },
  errorMsg: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean
  },
  disableInput: {
    default: false,
    type: Boolean
  }
});

const selected = ref({} as PickerOption);
const emit = defineEmits(["update-selected"]);

onMounted(() => {
  setValue(props.defaultOption);
});

watch(
  () => props.defaultOption,
  (value: PickerOption, b: PickerOption) => {
    setValue(props.defaultOption);
  }
);

const optionsValue = computed(() => {
  const v = value.value.toLowerCase();

  const items = (props.options ?? [])?.filter((item) => {
    const name = item.label?.toLocaleLowerCase() ?? "";
    if (name.includes(v)) {
      return true;
    }
    return false;
  });

  if (items.length > 0) {
    return items;
  }

  return props.options;
});

function setValue(option: PickerOption) {
  for (const item of props.options ?? []) {
    if (item.value == option.value) {
      selected.value = item;
      break;
    }
  }
}

function focusOut() {
  setTimeout(() => {
    value.value = "";
  }, 200);
}

function onSelect(v: ExternalCurrency | AssetBalance) {
  value.value = "";
  emit("update-selected", v);
}
</script>
