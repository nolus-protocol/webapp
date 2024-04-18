<template>
  <!-- Header -->
  <div class="modal-send-receive-header flex">
    <div class="navigation-header">
      <div class="flex flex-col items-center justify-center">
        <CheckIcon
          v-if="isStepSuccess"
          class="radius-circle success-icon mb-2 h-14 w-14 p-2"
        />
        <XMarkIcon
          v-if="isStepError"
          class="radius-circle error-icon mb-2 h-14 w-14 p-2"
        />
        <h1 class="nls-font-700 text-center text-28 text-primary md:text-32">
          {{ $t(`message.${step}`) }}
        </h1>
      </div>
    </div>
  </div>

  <div
    v-if="isStepSuccess"
    class="modal-form"
  >
    <div class="radius-rounded mx-[24px] my-[24px] block break-words bg-light-grey p-[24px] text-center">
      {{ $t("message.swap-success") }}
    </div>
    <div class="flex gap-8 px-[24px] pb-[28px]">
      <button
        class="btn btn-primary btn-large-primary w-full"
        @click="onBackClick"
      >
        {{ $t("message.swap-again") }}
      </button>

      <button
        class="btn btn-secondary btn-large-secondary w-full"
        @click="onOkClick"
      >
        {{ $t("message.close") }}
      </button>
    </div>
  </div>

  <div
    v-if="isStepError"
    class="modal-form"
  >
    <div class="radius-rounded mx-[24px] my-[24px] block break-words bg-light-grey p-[24px] text-center">
      {{ errorMsg }}
    </div>
    <div class="px-[24px] pb-[28px]">
      <button
        class="btn btn-primary btn-large-primary w-full"
        @click="onOkClick"
      >
        {{ $t("message.close") }}
      </button>
    </div>
  </div>

  <form
    v-if="isStepConfirm || isStepPending"
    class="modal-form"
    @submit.prevent="onSendClick"
  >
    <!-- Input Area -->
    <div class="modal-send-receive-input-area pt-0">
      <div class="radius-rounded mt-[25px] block break-words bg-light-grey p-4 text-left">
        <div class="block">
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.swap") }}:</p>
          <p class="nls-font-700 m-0 text-14 text-primary">{{ swapAmount }}</p>
        </div>

        <div class="mt-3 block">
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.for") }}:</p>
          <p class="nls-font-700 m-0 text-14 text-primary">{{ forAmount }}</p>
        </div>

        <!-- <div
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
        </div> -->
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
      :isWarning="true"
      class="mx-[18px] mb-[4px] lg:mx-[38px] lg:mb-[20px]"
    >
      <template v-slot:icon>
        <img
          class="mx-auto my-0 block h-7 w-10"
          src="@/assets/icons/information-circle.svg"
        />
      </template>
      <template v-slot:content>
        <span
          class="text-primary"
          v-html="
            $t('message.swap-confirm-warning', {
              txs: `${txs} ${txs > 1 ? $t('message.transactions') : $t('message.transaction')}`
            })
          "
        >
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
import WarningBox from "./WarningBox.vue";

import type { Coin } from "@cosmjs/amino";
import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils } from "@/common/utils";
import { CONFIRM_STEP } from "@/common/types";

interface Props {
  txType: string;
  txHash: string[];
  swapAmount: string;
  forAmount: string;
  step: CONFIRM_STEP;
  errorMsg: string;
  fee?: Coin;
  txs: number;
  onSendClick: () => void;
  onBackClick: () => void;
  onOkClick: () => void;
}

const props = defineProps<Props>();
const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM);
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING);
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS);
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR);

const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (n: boolean) => {});

onMounted(() => {
  setShowDialogHeader(false);
});

watch(
  () => props.step,
  () => {
    switch (props.step) {
      case CONFIRM_STEP.PENDING: {
        setDisable(true);
        break;
      }
      case CONFIRM_STEP.SUCCESS: {
        setDisable(true);
        break;
      }
      case CONFIRM_STEP.ERROR: {
        setDisable(true);
        break;
      }
      default: {
        setDisable(false);
        break;
      }
    }
  }
);

function calculateFee(coin: Coin) {
  const asset = AssetUtils.getCurrencyByDenom(coin.denom);

  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    asset.ibcData,
    asset.shortName,
    asset.decimal_digits
  );
}
</script>
