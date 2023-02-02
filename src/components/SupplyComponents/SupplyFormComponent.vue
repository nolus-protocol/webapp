<template>
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <!-- Input Area -->
    <div class="modal-send-receive-input-area">
      <div
        class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
      >
        <span class="text-14 nls-font-500"
          >{{ $t("message.current-apr") }}:</span
        >
        <span class="text-14 nls-font-700 ml-2">
          {{ modelValue.currentAPR }}
        </span>
      </div>

      <div class="block text-left mt-[25px]">
        <CurrencyField
          id="amountSupply"
          :currency-options="modelValue.currentBalance"
          :disabled-currency-picker="false"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          :label="$t('message.amount')"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
        <WarningBox :isWarning="true" class="mt-[25px]">
          <template v-slot:icon>
            <img
              class="block mx-auto my-0 w-10 h-10"
              src="@/assets/icons/information-circle.svg"
            />
          </template>
          <template v-slot:content>
            <span>
              {{ $t("message.rewards-compount") }}
            </span>
          </template>
        </WarningBox>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.supply") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { SupplyFormComponentProps } from "@/types/component/SupplyFormComponentProps";
import type { PropType } from "vue";

import CurrencyField from "@/components/CurrencyField.vue";
import WarningBox from "@/components/modals/templates/WarningBox.vue";

const props = defineProps({
  modelValue: {
    type: Object as PropType<SupplyFormComponentProps>,
    required: true,
  },
});

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

defineEmits(["update:modelValue.selectedCurrency"]);
</script>
