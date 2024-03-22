<template>
  <form
    @submit.prevent="modelValue.onNextClick"
    class="modal-form"
  >
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
          :balance="formatCurrentBalance(modelValue.currentDepositBalance)"
          :total="modelValue.currentDepositBalance.balance"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
          :disabled-currency-picker="true"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.withdraw") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import type { WithdrawFormComponentProps } from "./types";
import type { PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils } from "@/common/utils";

const props = defineProps({
  modelValue: {
    type: Object as PropType<WithdrawFormComponentProps>,
    required: true
  }
});

defineEmits(["update:modelValue.selectedCurrency"]);

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = AssetUtils.getCurrencyByDenom(selectedCurrency?.balance?.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.decimal_digits
    ).toString();
  }
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}
</script>
