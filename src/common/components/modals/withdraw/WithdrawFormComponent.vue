<template>
  <form
    class="flex flex-col gap-8 px-10 py-6"
    @submit.prevent="modelValue.onNextClick"
  >
    <CurrencyField
      id="amountSupply"
      :balance="formatCurrentBalance(modelValue.currentDepositBalance)"
      :currency-options="modelValue.currentBalance"
      :disabled-currency-picker="modelValue.disabled"
      :error-msg="modelValue.amountErrorMsg"
      :is-error="modelValue.amountErrorMsg !== ''"
      :label="$t('message.amount')"
      :option="modelValue.selectedCurrency"
      :total="modelValue.currentDepositBalance.balance"
      :value="modelValue.amount"
      class="text-left"
      name="amountSupply"
      @input="handleAmountChange($event)"
      @update-currency="(event) => (modelValue.selectedCurrency = event)"
    />

    <!-- Actions -->
    <Button
      :label="$t('message.withdraw')"
      class="w-full"
      severity="primary"
      size="large"
      type="submit"
    />
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";

import type { WithdrawFormComponentProps } from "./types";
import type { PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import type { ExternalCurrency } from "@/common/types";
import { Button } from "web-components";

const props = defineProps({
  modelValue: {
    type: Object as PropType<WithdrawFormComponentProps>,
    required: true
  }
});

defineEmits(["update:modelValue.selectedCurrency"]);

function formatCurrentBalance(selectedCurrency: ExternalCurrency) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      selectedCurrency.shortName,
      selectedCurrency.decimal_digits
    ).toString();
  }
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}
</script>
