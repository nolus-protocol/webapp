<template>
  <div class="">
    <Combobox v-model="selected">
      <ComboboxLabel>{{ formFieldModel.label }}</ComboboxLabel>
      <div class="relative mt-1">
        <div
          :class="formFieldModel.isError ? 'error' : false"
          class="relative nolus-combo-field w-full cursor-default overflow-hidden rounded-lg bg-white text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm"
        >
          <ComboboxInput
            class="bg-white relative w-full pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            :displayValue="(el) => el.label || selected.label"
            @change="query = $event.target.value"
            @update="(event) => (selected = event.target)"
          />
          <ComboboxButton
            class="absolute nolus-combo-button formFieldModelombo-button inset-y-0 right-0 flex items-center"
          >
            <span class="icon icon-star mr-0"></span>
          </ComboboxButton>
        </div>
        <TransitionRoot
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-100"
          @after-leave="query = ''"
          class="nolus-combo"
        >
          <ComboboxOptions
            class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
          >
            <ComboboxOption
              v-for="option in formFieldModel.options"
              as="template"
              :key="option.value"
              :value="option"
              v-slot="{ selected }"
            >
              <li class="flex justify-start">
                <span class="icon icon-person" />
                <span
                  class="block truncate"
                  :class="{
                    'color-light-electric': selected,
                    'text-primary': !selected,
                  }"
                >
                  {{ option.label }}
                </span>
              </li>
            </ComboboxOption>
          </ComboboxOptions>
        </TransitionRoot>
      </div>
    </Combobox>
    <span
      :class="[
        'msg error color-light-red nls-font-500 nls-14',
        typeof formFieldModel.errorMsg !== 'undefined' &&
        formFieldModel.errorMsg !== null
          ? ''
          : 'hidden',
      ]"
      >{{
        typeof formFieldModel.errorMsg !== "undefined" &&
        formFieldModel.errorMsg !== null
          ? formFieldModel.errorMsg
          : ""
      }}</span
    >
  </div>
</template>

<script lang="ts">
import {
  ComboboxButton,
  ComboboxLabel,
  Combobox,
  ComboboxInput,
  ComboboxOptions,
  ComboboxOption,
  TransitionRoot,
} from "@headlessui/vue";
import { CheckIcon, StarIcon } from "@heroicons/vue/solid";
import { PropType } from "@vue/runtime-core";
import { ref, computed } from "vue";
import type { Ref } from "vue";
import { PickerDefaultOption } from "./PickerDefault.vue";

export default {
  name: "PickerCombo",
  components: {
    Combobox,
    ComboboxButton,
    ComboboxLabel,
    ComboboxInput,
    ComboboxOption,
    ComboboxOptions,
    TransitionRoot,
    CheckIcon,
    StarIcon,
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
  data() {
    return {
      selected: {} as PickerDefaultOption,
      query: ref("") as Ref<string>,
    };
  },

  watch: {
    selected() {
      //@ts-ignore
      (this.formFieldModel || {}).value = this.selected.value;
    },
  },
  // TODO : set query wather to filter input value
};
</script>
