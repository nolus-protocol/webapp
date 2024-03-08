<template>
  <!-- Header -->
  <div
    :class="{ 'no-border': !isStepCustomError }"
    class="modal-send-receive-header flex"
  >
    <div class="navigation-header">
      <div class="flex flex-col items-center justify-center">
        <CheckIcon
          v-if="isStepSuccess"
          class="radius-circle success-icon mb-2 h-14 w-14 p-2"
        />
        <XMarkIcon
          v-if="isStepError || isStepCustomError"
          class="radius-circle error-icon mb-2 h-14 w-14 p-2"
        />
        <h1 class="nls-font-700 text-center text-28 text-primary md:text-32">
          {{ $t(`message.${step}`) }}
        </h1>
      </div>
    </div>
  </div>

  <div
    v-if="isStepCustomError"
    class="modal-form"
  >
    <div class="py-[28px]">
      {{ $t("message.gassErrorMsg") }}
    </div>
    <div class="px-[12px] pb-[28px]">
      <button
        class="btn btn-primary btn-large-primary w-auto"
        @click="btnAction"
      >
        {{ $t("message.close") }}
      </button>
    </div>
  </div>
  <form
    v-else
    class="modal-form"
    @submit.prevent="btnAction"
  >
    <!-- Input Area -->
    <div class="modal-send-receive-input-area pt-0">
      <div class="radius-rounded mt-[25px] block break-words bg-light-grey p-4 text-left">
        <div class="block">
          <p class="nls-font-400 m-0 text-14 text-primary">{{ txType }}</p>
          <p class="nls-font-700 m-0 text-14 text-primary">
            {{ receiverAddress }}
          </p>
        </div>

        <div
          v-if="memo"
          class="mt-3 block"
        >
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.memo") }}:</p>
          <p class="nls-font-700 m-0 text-14 text-primary">
            {{ memo }}
          </p>
        </div>

        <div class="mt-3 block">
          <p class="nls-font-400 m-0 text-14 text-primary">
            {{ $t("message.amount") }}
          </p>
          <p class="nls-font-700 m-0 text-14 text-primary">
            {{ formatAmount(amount) }}
          </p>
        </div>

        <div
          v-if="txHash"
          class="mt-3 block"
        >
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.tx-hash") }}:</p>
          <a
            :href="`${applicaton.network.networkAddresses.explorer}/${txHash}`"
            class="his-url m-0 text-14"
            target="_blank"
          >
            {{ StringUtils.truncateString(txHash, 6, 6) }}
          </a>
        </div>
        <div
          v-if="fee"
          class="mt-3 block"
        >
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.tx-and-fee") }}:</p>
          <p class="nls-font-700 m-0 text-14 text-primary">~{{ calculateFee(fee) }}</p>
        </div>
      </div>
    </div>

    <WarningBox
      v-if="isStepConfirm"
      :isWarning="true"
      class="mx-[38px] mb-[20px]"
    >
      <template v-slot:icon>
        <img
          class="mx-auto my-0 block h-7 w-10"
          src="@/assets/icons/information-circle.svg"
        />
      </template>
      <template v-slot:content>
        <span class="text-primary">
          {{ $t("message.amount-warning") }}
        </span>
      </template>
    </WarningBox>

    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button :class="`btn btn-primary btn-large-primary ${isStepPending ? 'js-loading' : ''}`">
        {{ isStepConfirm ? $t("message.confirm") : $t("message.ok") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";

import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { StringUtils } from "@/common/utils";
import { CONFIRM_STEP } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { useApplicationStore } from "@/common/stores/application";
import WarningBox from "./WarningBox.vue";

const wallet = useWalletStore();
const applicaton = useApplicationStore();

interface Props {
  selectedCurrency: AssetBalance;
  receiverAddress: string;
  amount: string;
  memo?: string;
  txType: string;
  txHash: string;
  step: CONFIRM_STEP;
  fee?: Coin;
  onSendClick: () => void;
  onBackClick: () => void;
  onOkClick: () => void;
}

const props = defineProps<Props>();
const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM);
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING);
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS);
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR);
const isStepCustomError = computed(() => props.step === CONFIRM_STEP.GasError);
const btnAction = computed(() => {
  return isStepConfirm.value ? props.onSendClick : props.onOkClick;
});

const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (n: boolean) => {});

onMounted(() => {
  setShowDialogHeader(false);
});

watch(
  () => props.step,
  () => {
    if (props.step == CONFIRM_STEP.PENDING) {
      setDisable(true);
    } else {
      setDisable(false);
    }
  }
);

function formatAmount(value: string) {
  const selectedCurrency = props.selectedCurrency;

  if (!selectedCurrency) {
    return;
  }

  const { shortName, coinMinimalDenom, coinDecimals } = wallet.getCurrencyInfo(selectedCurrency.balance.denom);

  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(value, coinMinimalDenom, coinDecimals);
  return CurrencyUtils.convertMinimalDenomToDenom(
    minimalDenom.amount.toString(),
    coinMinimalDenom,
    shortName,
    coinDecimals
  );
}

function calculateFee(coin: Coin) {
  const { shortName, coinMinimalDenom, coinDecimals } = wallet.getCurrencyInfo(coin.denom);

  return CurrencyUtils.convertMinimalDenomToDenom(coin.amount.toString(), coinMinimalDenom, shortName, coinDecimals);
}
</script>
