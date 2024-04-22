<template>
  <form
    class="modal-form"
    @submit.prevent="submit"
  >
    <!-- Input Area -->
    <div class="modal-send-receive-input-area">
      <div class="mt-[25px] block text-left">
        <CurrencyField
          id="amountSupply"
          :currency-options="modelValue.currentBalance"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          :label="$t('message.amount')"
          :balance="formatCurrentBalance(modelValue.selectedCurrency)"
          :total="modelValue.selectedCurrency?.balance"
          :disabled-currency-picker="modelValue.disabled"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (props.modelValue.selectedCurrency = event)"
        />
      </div>
    </div>
    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button
        class="btn btn-primary btn-large-primary min-h-[44px] text-center"
        :class="{ 'js-loading': props.modelValue.loading }"
        :disabled="!props.modelValue.supply"
      >
        {{
          props.modelValue.loading
            ? ""
            : props.modelValue.supply
              ? $t("message.supply")
              : $t("message.supply-limit-reached")
        }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { SupplyFormComponentProps } from "./types";
import type { PropType } from "vue";
import type { ExternalCurrency } from "@/common/types";
import { CurrencyUtils } from "@nolus/nolusjs";
import CurrencyField from "@/common/components/CurrencyField.vue";

const props = defineProps({
  modelValue: {
    type: Object as PropType<SupplyFormComponentProps>,
    required: true
  }
});

function submit() {
  if (props.modelValue.supply) {
    props.modelValue.onNextClick();
  }
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}

function formatCurrentBalance(selectedCurrency: ExternalCurrency) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = props.modelValue.selectedCurrency;
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.decimal_digits
    ).toString();
  }
}

defineEmits(["update:modelValue.selectedCurrency"]);
</script>
