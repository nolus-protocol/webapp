<template>
  <form
    @submit.prevent="modelValue.onNextClick"
    class="modal-form"
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
          :balance="formatCurrentBalance()"
          :total="props.modelValue.selectedCurrency.balance"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
        <WarningBox
          :isWarning="true"
          class="mt-[25px]"
        >
          <template v-slot:icon>
            <img
              class="mx-auto my-0 block h-7 w-10"
              src="@/assets/icons/information-circle.svg"
            />
          </template>
          <template v-slot:content>
            <span class="text-primary">
              {{ $t("message.delegate-description") }}
            </span>
          </template>
        </WarningBox>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.delegate") }}
      </button>
      <a
        :href="`${NETWORKS[EnvNetworkUtils.getStoredNetworkName()].staking}`"
        class="his-url mt-4 flex flex self-start text-14"
        target="_blank"
      >
        {{ $t("message.manual-delegation") }}
        <img
          src="@/assets/icons/urlicon.svg"
          class="his-img float-right mb-[2px] ml-2 w-3"
        />
      </a>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { DelegateFormComponentProps } from "./types";
import type { PropType } from "vue";

import CurrencyField from "@/common/components/CurrencyField.vue";
import WarningBox from "@/common/components/modals/templates/WarningBox.vue";

import { CurrencyUtils } from "@nolus/nolusjs";
import { EnvNetworkUtils } from "@/common/utils";
import { NETWORKS } from "@/config/global";

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
