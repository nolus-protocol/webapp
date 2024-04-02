<template>
  <div class="modal-send-receive-input-area">
    <div class="radius-light nls-font-400 mb-[13px] block bg-light-grey px-4 py-3 text-left text-14 text-primary">
      {{ $t("message.balance") }}:
      <a
        class="text-secondary nls-font-700 ml-2 underline"
        href="#"
      >
        {{ formatCurrentBalance(selectedCurrency) }}
      </a>
    </div>
    <div class="block text-left">
      <MultipleCurrencyField
        :amount="amount"
        :currencyOptions="currentBalance"
        :selectedOption="selectedCurrency"
        :swapToOption="swapToSelectedCurrency"
        :isError="!!errorMsg"
        :errorMsg="errorMsg"
        @updateCurrency="(value: AssetBalance) => $emit('updateSelected', value)"
        @updateSwapToCurrency="(value: AssetBalance) => $emit('updateSwapToSelected', value)"
        @updateAmount="(value: string) => $emit('updateAmount', value)"
      />
      <div class="mt-[25px] flex w-full">
        <!-- @TODO: Implement -->
        <div class="grow-3 nls-font-500 text-right text-14">
          <p class="mt-nollus-255 mb-3 mr-5">{{ $t("message.minimum-received") }}:</p>
          <p class="mb-3 mr-5">{{ $t("message.tx-fee") }}:</p>
        </div>
        <div class="nls-font-700 text-right text-14">
          <p class="mt-nollus-255 mb-3">0.456232 ETH</p>
          <p class="mb-3">0.09233 ETH</p>
        </div>
      </div>
    </div>
  </div>

  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      @click="onSwapClick"
    >
      {{ `${$t("message.swap")} ${coinAbbr} ${$t("message.for")} ${swapToCoinAbbr}` }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import type { AssetBalance } from "@/common/stores/wallet/types";
import MultipleCurrencyField from "@/common/components/MultipleCurrencyField.vue";

import { computed } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { AssetUtils } from "@/common/utils";

interface Props {
  selectedCurrency: AssetBalance;
  swapToSelectedCurrency: AssetBalance;
  currentBalance: AssetBalance[];
  amount: string;
  onSwapClick: () => void;
  errorMsg: string;
}

const wallet = useWalletStore();
const props = defineProps<Props>();
defineEmits(["updateSelected", "updateAmount", "updateSwapToSelected"]);

const coinAbbr = computed(() =>
  AssetUtils.getCurrencyByDenom(props.selectedCurrency.balance.denom).ticker.toUpperCase()
);
const swapToCoinAbbr = computed(() =>
  AssetUtils.getCurrencyByDenom(props.swapToSelectedCurrency.balance.denom).ticker.toUpperCase()
);

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = AssetUtils.getCurrencyByDenom(selectedCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.ibcData,
      asset.decimal_digits
    ).toString();
  }
}
</script>
