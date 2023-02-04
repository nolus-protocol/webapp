<template>
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <div class="modal-send-receive-input-area">
      <div class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary">
        <span class="text-14 nls-font-500">
          {{ $t("message.delegated") }}:
        </span>
        <a class="text-secondary text-14 nls-font-700 underline ml-2 cursor-pointer" @click.stop="setAmount()">
          {{ formatCurrentBalance() }}
        </a>
      </div>
      <div class="block text-left mt-[25px]">
        <CurrencyField id="amountSupply" :currency-options="modelValue.currentBalance" :disabled-currency-picker="true"
          :error-msg="modelValue.amountErrorMsg" :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency" :value="modelValue.amount" :label="$t('message.amount')"
          name="amountSupply" @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)" />
        <WarningBox :isWarning="true" class="mt-[25px]">
          <template v-slot:icon>
            <img class="block mx-auto my-0 w-10 h-7" src="@/assets/icons/information-circle.svg" />
          </template>
          <template v-slot:content>
            <span>
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
      <template v-for="(item, index) in modelValue.undelegations" :key="index">
        <div v-for="(data, i) in item.entries" class="flex justify-between w-full text-light-blue text-[12px] mt-2" :key="i">
          <p>{{ $t("message.undelegating") }}: {{  transform(data.balance)  }}</p>
          <p>{{ datePraser(data.completion_time) }}</p>
        </div>
      </template>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/components/CurrencyField.vue";
import WarningBox from "../modals/templates/WarningBox.vue";

import type { UndelegateFormComponentProps } from "@/types/component";
import type { PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/stores/wallet";
import { NATIVE_ASSET } from "@/config/env";
import { datePraser } from "@/components/utils/datePraser";

const props = defineProps({
  modelValue: {
    type: Object as PropType<UndelegateFormComponentProps>,
    required: true,
  },
});

const walletStore = useWalletStore();

defineEmits(["update:modelValue.selectedCurrency"]);

function formatCurrentBalance() {
  if (props.modelValue.delegated) {
    const asset = walletStore.getCurrencyInfo(props.modelValue.delegated.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      props.modelValue.delegated.amount.toString(),
      props.modelValue.delegated.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
}

function transform(amount: string){
  const asset = walletStore.getCurrencyInfo(NATIVE_ASSET.denom);

  return CurrencyUtils.convertMinimalDenomToDenom(
      amount,
      asset.coinMinimalDenom,
      asset.coinDenom,
      asset.coinDecimals
    ).hideDenom(true).toString();
}

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const setAmount = () => {
  if(props.modelValue.delegated){
    const asset = walletStore.getCurrencyInfo(
      props.modelValue.selectedCurrency.balance.denom
    );
    const data = CurrencyUtils.convertMinimalDenomToDenom(
      props.modelValue.delegated.amount.toString(),
      props.modelValue.delegated.denom,
      asset.coinDenom,
      asset.coinDecimals
    );
    props.modelValue.amount = Number(data.toDec().toString()).toString();
  }
};
</script>
