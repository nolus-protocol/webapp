<template>
  <form
    class="flex flex-col gap-8 px-10 py-6"
    @submit.prevent="submit"
  >
    <!-- Input Area -->
    <CurrencyField
      id="amountSupply"
      :balance="formatCurrentBalance(modelValue.selectedCurrency)"
      :currency-options="modelValue.currentBalance"
      :disabled-currency-picker="modelValue.disabled"
      :error-msg="modelValue.amountErrorMsg"
      :is-error="modelValue.amountErrorMsg !== ''"
      :label="$t('message.amount')"
      :option="modelValue.selectedCurrency"
      :total="modelValue.selectedCurrency?.balance"
      :value="modelValue.amount"
      class="text-left"
      name="amountSupply"
      @input="handleAmountChange($event)"
      @update-currency="(event) => (props.modelValue.selectedCurrency = event)"
    />
    <!-- Actions -->
    <Button
      :disabled="!props.modelValue.supply || disabled.includes(modelValue.selectedCurrency.key)"
      :label="
        props.modelValue.loading
          ? ''
          : props.modelValue.supply
            ? $t('message.supply')
            : $t('message.supply-limit-reached')
      "
      :loading="props.modelValue.loading"
      class="w-full"
      severity="primary"
      size="large"
      type="submit"
    />
  </form>
</template>

<script lang="ts" setup>
import type { SupplyFormComponentProps } from "./types";
import type { PropType } from "vue";
import type { ExternalCurrency } from "@/common/types";
import { CurrencyUtils } from "@nolus/nolusjs";
import CurrencyField from "@/common/components/CurrencyField.vue";
import { Button } from "web-components";

const disabled = ["USDC_AXELAR@OSMOSIS-OSMOSIS-USDC_AXELAR"];

const props = defineProps({
  modelValue: {
    type: Object as PropType<SupplyFormComponentProps>,
    required: true
  }
});

function submit() {
  if (props.modelValue.supply && !disabled.includes(props.modelValue.selectedCurrency.key)) {
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
