<template>
  <div class="block currency-field-container">
    <label :for="this.id" class="block nls-14 nls-font-500 text-primary">{{
      this.label
    }}</label>

    <div
      :class="[
        typeof this.isError !== 'undefined' && this.isError === true
          ? 'error'
          : '',
        'currency-field p-3.5',
      ]"
    >
      <div class="flex items-center">
        <div class="inline-block w-1/2">
          <input
            type="number"
            :name="this.name"
            :id="this.id"
            :value="value"
            :step="this.step"
            @input="$emit('update:value', $event.target.value)"
            :disabled="disabledInputField"
            class="nls-font-700 nls-18 nls-font-700 text-primary"
          />
          <span class="block nls-14 nls-font-400 text-light-blue">
            $1,000
          </span>
        </div>
        <div class="inline-block w-1/2">
          <CurrencyPicker
            :options="currencyOptions"
            type="small"
            :currency-option="option"
            :disabled="disabledCurrencyPicker"
            @update-currency="onUpdateCurrency"
          />
        </div>
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
</template>

<script lang="ts">
import CurrencyPicker from "@/components/CurrencyPicker.vue";
import { AssetBalance } from "@/store/modules/wallet/state";
import { defineComponent, PropType } from "vue";

export default defineComponent({
  name: "CurrencyField",
  components: {
    CurrencyPicker,
  },
  props: {
    name: {
      type: String,
    },
    value: {
      type: String,
    },
    currencyOptions: {
      type: Array as PropType<AssetBalance[]>,
    },
    step: {
      type: String,
    },
    option: {
      type: Object as PropType<AssetBalance>,
    },
    id: {
      type: String,
    },
    label: {
      type: String,
    },
    disabledInputField: {
      type: Boolean,
    },
    disabledCurrencyPicker: {
      type: Boolean,
    },
    isError: {
      type: Boolean,
    },
    errorMsg: {
      type: String,
    },
  },
  data() {
    return {};
  },
  methods: {
    onUpdateCurrency(value: AssetBalance) {
      this.$emit("update-currency", value);
    },
  },
});
</script>
