<template>
  <fieldset>
    <div class="block input-field">
      <label
        :for="this.id"
        class="block nls-14 nls-font-400 text-primary nls-font-400"
        >{{ this.label }}</label
      >
      <div class="field-container text-field-buttons">
        <textarea
          :name="this.name"
          :id="this.id"
          :value="value"
          @input="$emit('update:value', $event.target.value)"
          :disabled="true"
          :class="
            typeof this.isError !== 'undefined' && this.isError === true
              ? 'error'
              : ''
          "
        ></textarea>
        <div
          class="flex align-center justify-end p-3 bg-light-grey buttons-container"
        >
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon mr-4"
            v-on:click="onClickCopy"
          >
            <DuplicateIcon class="icon w-4 h-4" />
            Copy
          </button>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon"
            v-on:click="onClickPrint"
          >
            <PrinterIcon class="icon w-4 h-4" />
            Print
          </button>
        </div>
      </div>
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
    </div>
  </fieldset>
</template>

<script>
import { DuplicateIcon, PrinterIcon } from "@heroicons/vue/solid";

export default {
  name: "TextFieldButtons",
  components: {
    DuplicateIcon,
    PrinterIcon,
  },
  props: {
    name: {
      type: String,
    },
    id: {
      type: String,
    },
    value: {
      type: String,
    },
    label: {
      type: String,
    },
    buttons: {
      type: String,
    },
    isError: {
      type: Boolean,
    },
    errorMsg: {
      type: String,
    },
    onClickCopy: {
      type: Function,
    },
    onClickPrint: {
      type: Function,
    },
  },
  data() {
    return {
      default: {
        value: "",
      },
    };
  },
};
</script>
