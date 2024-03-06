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
          :disabled-currency-picker="true"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
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
import { type PropType } from "vue";
import type { AssetBalance } from "@/common/stores/wallet/types";

import CurrencyField from "@/common/components/CurrencyField.vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";

const props = defineProps({
  modelValue: {
    type: Object as PropType<SupplyFormComponentProps>,
    required: true
  }
});

const wallet = useWalletStore();

function submit() {
  if (props.modelValue.supply) {
    props.modelValue.onNextClick();
  }
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
  }
}

defineEmits(["update:modelValue.selectedCurrency"]);
</script>
