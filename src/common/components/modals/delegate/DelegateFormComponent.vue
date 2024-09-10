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
        :total="props.modelValue.selectedCurrency.balance"
        :value="modelValue.amount"
        name="amountSupply"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
      <NotificationBox :type="NotificationBoxType.warning">
        <template v-slot:content>
          {{ $t("message.delegate-description") }}
        </template>
      </NotificationBox>
    </div>

    <!-- Actions -->
    <div class="flex flex-col justify-center text-center">
      <Button
        :label="$t('message.delegate')"
        class="my-8"
        severity="primary"
        size="large"
        type="submit"
      />
      <a
        :href="`${NETWORK.staking}`"
        class="text-primary-50 flex self-center text-14"
        target="_blank"
      >
        {{ $t("message.manual-delegation") }}
        <img
          class="float-right mb-[2px] ml-2 w-3"
          src="@/assets/icons/urlicon.svg"
        />
      </a>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { DelegateFormComponentProps } from "./types";
import type { PropType } from "vue";

import CurrencyField from "@/common/components/CurrencyField.vue";
import { Button, NotificationBox, NotificationBoxType } from "web-components";

import { CurrencyUtils } from "@nolus/nolusjs";
import { NETWORK } from "@/config/global";

const props = defineProps({
  modelValue: {
    type: Object as PropType<DelegateFormComponentProps>,
    required: true
  }
});

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}

function formatCurrentBalance() {
  return CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.selectedCurrency.balance.amount.toString(),
    props.modelValue.selectedCurrency.balance.denom,
    props.modelValue.selectedCurrency.shortName,
    props.modelValue.selectedCurrency.decimal_digits
  ).toString();
}

defineEmits(["update:modelValue.selectedCurrency"]);
</script>
