<template>
  <form
    class="px-10 py-6"
    @submit.prevent="modelValue.onNextClick"
  >
    <div class="flex flex-col gap-4">
      <CurrencyField
        id="amountSupply"
        :balance="formatCurrentBalance()"
        :currency-options="modelValue.currentBalance"
        :disabled-currency-picker="true"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :label="$t('message.amount')"
        :option="modelValue.selectedCurrency"
        :total="props.modelValue.delegated!"
        :value="modelValue.amount"
        name="amountSupply"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <NotificationBox :type="NotificationBoxType.warning">
        <template v-slot:content>
          {{ $t("message.undelegate-description") }}
        </template>
      </NotificationBox>
    </div>

    <!-- Actions -->
    <div class="flex flex-col justify-center text-center">
      <Button
        :label="$t('message.undelegated')"
        class="my-8"
        severity="primary"
        size="large"
        type="submit"
      />
      <template
        v-for="(item, index) in modelValue.undelegations"
        :key="index"
      >
        <div
          v-for="(data, i) in item.entries"
          :key="i"
          class="mt-2 flex w-full justify-between text-[12px] text-light-blue"
        >
          <p>{{ $t("message.undelegating") }}: {{ transform(data.balance) }}</p>
          <p>{{ datePraser(data.completion_time, true) }}</p>
        </div>
      </template>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";
import { Button, NotificationBox, NotificationBoxType } from "web-components";

import type { UndelegateFormComponentProps } from "./types";
import type { PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { datePraser } from "@/common/utils";

const props = defineProps({
  modelValue: {
    type: Object as PropType<UndelegateFormComponentProps>,
    required: true
  }
});

defineEmits(["update:modelValue.selectedCurrency"]);

function formatCurrentBalance() {
  if (props.modelValue.delegated) {
    return CurrencyUtils.convertMinimalDenomToDenom(
      props.modelValue.delegated.amount.toString(),
      props.modelValue.delegated.denom,
      props.modelValue.selectedCurrency.shortName,
      props.modelValue.selectedCurrency.decimal_digits
    ).toString();
  }
}

function transform(amount: string) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    amount,
    props.modelValue.selectedCurrency.ibcData,
    props.modelValue.selectedCurrency.shortName,
    props.modelValue.selectedCurrency.decimal_digits
  )
    .hideDenom(true)
    .toString();
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}
</script>
