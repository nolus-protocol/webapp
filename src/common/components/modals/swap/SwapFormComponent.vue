<template>
  <div class="modal-send-receive-input-area">
    <div class="currency-field-container flex items-center justify-end">
      <div
        class="balance cursor-pointer select-none"
        @click="setBalance"
      >
        {{ $t("message.balance") }} {{ formatCurrentBalance(selectedCurrency) }}
      </div>
    </div>
    <div class="block text-left">
      <MultipleCurrencyField
        :amount="amount"
        :currencyOptions="currentBalance"
        :selectedOption="selectedCurrency"
        :swapToOption="swapToSelectedCurrency"
        :swapToAmount="swapToAmount"
        :isError="errorMsg.length > 0"
        :errorMsg="errorMsg"
        @updateCurrency="(value) => $emit('updateSelected', value)"
        @updateSwapToCurrency="(value) => $emit('updateSwapToSelected', value)"
        @updateAmount="(value) => $emit('updateAmount', value)"
        @updateSwapToAmount="(value) => $emit('updateSwapToAmount', value)"
      />
      <p class="mt-2 text-right text-xs text-light-blue">{{ $t("message.slippage") }} 1%</p>
    </div>
    <div class="flex justify-end">
      <div class="grow-3 nls-font-500 dark-text text-right text-14">
        <p class="mb-2 mr-5 mt-[14px]">
          {{ $t("message.price-impact") }}
        </p>
        <p class="mb-2 mr-5 mt-[14px]">
          {{ $t("message.min-received") }}
        </p>
        <p class="mb-2 mr-5 mt-[14px]">
          {{ $t("message.swap-fee") }}
        </p>
      </div>
      <div class="nls-font-700 text-right text-14">
        <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">0.40%</p>
        <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">0.00 NLS</p>
        <p class="align-center dark-text mb-2 mt-[14px] flex justify-end">
          0.00 NLS
          <span class="nls-font-400 flex text-[#8396B1]">
            &nbsp;($0.00)
            <TooltipComponent :content="$t('message.swap-tooltip')" />
          </span>
        </p>
      </div>
    </div>
  </div>

  <div class="modal-send-receive-actions flex flex-col">
    <button
      :class="`btn btn-primary btn-large-primary text-center ${loading ? 'js-loading' : ''}`"
      @click="onSwapClick"
    >
      {{ $t("message.swap") }}
    </button>
    <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
      <p>{{ $t("message.estimate-time") }}:</p>
      <p>~{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ExternalCurrency } from "@/common/types";
import MultipleCurrencyField from "@/common/components/MultipleCurrencyField.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";

import { CurrencyUtils } from "@nolus/nolusjs";
import { NATIVE_NETWORK } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";

interface Props {
  selectedCurrency: ExternalCurrency;
  swapToSelectedCurrency: ExternalCurrency;
  currentBalance: ExternalCurrency[];
  loading: boolean;
  amount: string;
  swapToAmount: string;
  onSwapClick: () => void;
  errorMsg: string;
}

const props = defineProps<Props>();
const emit = defineEmits(["updateSelected", "updateAmount", "updateSwapToSelected", "updateSwapToAmount"]);

function setBalance() {
  const asset = new Dec(props.selectedCurrency.balance.amount, props.selectedCurrency.decimal_digits);
  emit("updateAmount", asset.toString(props.selectedCurrency.decimal_digits));
}

function formatCurrentBalance(selectedCurrency: ExternalCurrency) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    selectedCurrency.balance.amount.toString(),
    selectedCurrency.balance.ibcData,
    selectedCurrency.shortName,
    selectedCurrency.decimal_digits
  ).toString();
}
</script>
