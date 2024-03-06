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
          :balance="formatCurrentBalance()"
          :total="props.modelValue.delegated!"
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
              {{ $t("message.undelegate-description") }}
            </span>
          </template>
        </WarningBox>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions flex-col">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.undelegated") }}
      </button>
      <template
        v-for="(item, index) in modelValue.undelegations"
        :key="index"
      >
        <div
          v-for="(data, i) in item.entries"
          class="mt-2 flex w-full justify-between text-[12px] text-light-blue"
          :key="i"
        >
          <p>{{ $t("message.undelegating") }}: {{ transform(data.balance) }}</p>
          <p>{{ datePraser(data.completion_time) }}</p>
        </div>
      </template>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/common/components/CurrencyField.vue";
import WarningBox from "../templates/WarningBox.vue";

import type { UndelegateFormComponentProps } from "./types";
import type { PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { NATIVE_ASSET } from "@/config/global";
import { datePraser } from "@/common/utils";

const props = defineProps({
  modelValue: {
    type: Object as PropType<UndelegateFormComponentProps>,
    required: true
  }
});

const walletStore = useWalletStore();

defineEmits(["update:modelValue.selectedCurrency"]);

function formatCurrentBalance() {
  if (props.modelValue.delegated) {
    const asset = walletStore.getCurrencyInfo(props.modelValue.delegated.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      props.modelValue.delegated.amount.toString(),
      props.modelValue.delegated.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
  }
}

function transform(amount: string) {
  const asset = walletStore.getCurrencyInfo(NATIVE_ASSET.denom);

  return CurrencyUtils.convertMinimalDenomToDenom(amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals)
    .hideDenom(true)
    .toString();
}

function handleAmountChange(value: string) {
  props.modelValue.amount = value;
}
</script>
