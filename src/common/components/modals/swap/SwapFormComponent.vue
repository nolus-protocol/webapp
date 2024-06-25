<template>
  <div class="mt-6">
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
        :disabled="disabled"
        :errorMsg="errorMsg"
        :isError="errorMsg.length > 0"
        :isLoading="false"
        :selectedOption="selectedCurrency"
        :swapToAmount="swapToAmount"
        :swapToOption="swapToSelectedCurrency"
        @changeFields="$emit('changeFields')"
        @updateAmount="(value) => $emit('updateAmount', value)"
        @updateCurrency="(value) => $emit('updateSelected', value)"
        @updateSwapToAmount="(value) => $emit('updateSwapToAmount', value)"
        @updateSwapToCurrency="(value) => $emit('updateSwapToSelected', value)"
      />
      <!-- <p class="mt-2 text-right text-xs text-light-blue">{{ $t("message.slippage") }} {{ slippage }}%</p> -->
    </div>
    <div class="mt-2 flex justify-end">
      <div class="flex-[3] text-right text-14 font-medium text-neutral-typography-200">
        <p class="mb-2 mr-5 mt-[14px]">
          {{ $t("message.slippage") }}
        </p>
        <p class="mb-2 mr-5 mt-[14px]">
          {{ $t("message.price-impact") }}
        </p>
        <p class="mb-2 mr-5 mt-[14px]">
          {{ $t("message.estimated-tx-fee") }}
        </p>
      </div>
      <div class="flex-[1] text-right text-14 font-semibold text-neutral-typography-200">
        <p class="align-center mb-2 mt-[14px] flex justify-end">{{ slippage }}%</p>
        <template v-if="loading">
          <p class="align-center mb-2 mt-[14px] flex justify-end">
            <span class="state-loading !mt-[5px] !w-[60px]"> </span>
          </p>
          <p class="align-center mb-2 mt-[14px] flex justify-end">
            <span class="state-loading !mt-[5px] !w-[60px]"> </span>
          </p>
        </template>
        <template v-else>
          <p class="align-center mb-2 mt-[14px] flex justify-end">{{ priceImpact }}%</p>
          <p class="align-center mb-2 mt-[14px] flex justify-end whitespace-pre">{{ swapFee }}</p>
        </template>
      </div>
    </div>
  </div>

  <div class="flex flex-col">
    <Button
      :disabled="disableForm"
      :label="$t('message.swap')"
      :loading="loading"
      class="my-8 w-full md:w-auto"
      severity="primary"
      size="large"
      @click="onSwapClick"
    />
    <div class="flex w-full justify-between text-[14px] text-neutral-400">
      <p>{{ $t("message.estimate-time") }}:</p>
      <p>~{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ExternalCurrency } from "@/common/types";
import type { Coin } from "@cosmjs/amino";
import MultipleCurrencyField from "@/common/components/MultipleCurrencyField.vue";
import { Button } from "web-components";

import { CurrencyUtils } from "@nolus/nolusjs";
import { NATIVE_NETWORK } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { AppUtils, Logger } from "@/common/utils";
import { onMounted, ref } from "vue";

interface Props {
  selectedCurrency: ExternalCurrency | null;
  swapToSelectedCurrency: ExternalCurrency | null;
  currentBalance: ExternalCurrency[];
  loading: boolean;
  disabled: boolean;
  amount: string;
  swapToAmount: string;
  priceImpact: string;
  onSwapClick: () => void;
  errorMsg: string;
  fee: Coin;
  swapFee: string;
  disableForm: boolean;
}

const slippage = ref<number | null>(null);
const props = defineProps<Props>();
const emit = defineEmits([
  "updateSelected",
  "updateAmount",
  "updateSwapToSelected",
  "updateSwapToAmount",
  "changeFields"
]);

onMounted(async () => {
  try {
    const config = await AppUtils.getSkipRouteConfig();
    slippage.value = config.slippage;
  } catch (error) {
    Logger.error(error);
  }
});

function setBalance() {
  const asset = new Dec(props.selectedCurrency!.balance.amount, props.selectedCurrency!.decimal_digits);
  emit("updateAmount", asset.toString(props.selectedCurrency!.decimal_digits));
}

function formatCurrentBalance(selectedCurrency: ExternalCurrency | null) {
  if (selectedCurrency) {
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.ibcData,
      selectedCurrency.shortName,
      selectedCurrency.decimal_digits
    ).toString();
  }
  return "0.00";
}
</script>
