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
    <div class="radius-rounded mx-[24px] my-[24px] block break-words bg-light-grey p-[24px] text-center text-primary">
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
    class="modal-form overflow-auto"
  >
    <div class="radius-rounded mx-[24px] my-[24px] block break-words bg-light-grey p-[24px] text-center text-primary">
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
      <div class="radius-rounded mt-[25px] block break-words bg-light-grey py-4 text-left">
        <div class="block px-4">
          <p class="nls-font-400 m-0 text-14 text-primary">{{ txType }}</p>
          <p class="nls-font-700 m-0 text-14 text-primary">
            {{ receiverAddress }}
          </p>
        </div>

        <div class="mt-3 block px-4">
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.amount") }}</p>
          <p class="nls-font-700 m-0 text-14 text-primary">{{ amount }}</p>
        </div>

        <div
          v-if="isStepConfirm"
          class="mt-3 block px-4"
        >
          <p class="nls-font-400 m-0 text-14 text-primary">{{ $t("message.tx-and-fee") }}:</p>
          <p class="nls-font-700 m-0 text-14 text-primary">~{{ calculateFee(fee) }}</p>
        </div>

        <span class="border-swap mt-3 block border-t"> </span>
        <div
          v-for="item in txs"
          class="block"
        >
          <p class="nls-font-400 m-0 p-4 pb-0 text-14 capitalize text-primary">
            {{ $t("message.transaction") }} {{ item }}:
          </p>

          <template v-if="txHashes[item - 1]">
            <a
              :href="`${applicaton.network.networkAddresses.explorer}/${txHashes[item - 1].hash}`"
              class="his-url nls-font-500 m-0 flex flex items-center justify-between px-4 text-14"
              target="_blank"
            >
              {{ StringUtils.truncateString(txHashes[item - 1].hash, 6, 6) }}
              <img
                v-if="txHashes[item - 1].status == SwapStatus.pending"
                class="copy-icon loader-animate"
                height="24"
                src="@/assets/icons/loading.svg"
                width="24"
              />

              <img
                v-if="txHashes[item - 1].status == SwapStatus.success"
                class="copy-icon"
                height="24"
                src="@/assets/icons/success.svg"
                width="24"
              />
            </a>
          </template>
          <template v-else>
            <p class="nls-font-700 m-0 px-4 text-14 text-primary">{{ $t("message.Pending") }}</p>
          </template>
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
        <template v-if="isStepPending">
          <span class="text-primary"> {{ $t("message.swap-sending", { tx: txs }) }} </span>
        </template>
        <span
          v-else
          class="text-primary"
          v-html="
            $t('message.swap-confirm-warning', {
              txs: `${txs} ${txs > 1 ? $t('message.transactions') : $t('message.transaction')}`
            })
          "
        >
        </span
        >.
        <span>&#160;{{ warning }} </span>
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
import { SwapStatus } from "../swap/types";
import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, StringUtils } from "@/common/utils";
import { CONFIRM_STEP } from "@/common/types";
import { useApplicationStore } from "@/common/stores/application";
import type { EvmNetwork, Network } from "@/common/types/Network";

interface Props {
  receiverAddress: string;
  txType: string;
  txHashes: { hash: string; status: SwapStatus }[];
  amount: string;
  step: CONFIRM_STEP;
  errorMsg: string;
  warning: string;
  fee: Coin;
  txs: number;
  network: EvmNetwork | Network;
  onSendClick: () => void;
  onBackClick: () => void;
  onOkClick: () => void;
}

const props = defineProps<Props>();
const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM);
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING);
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS);
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR);

const applicaton = useApplicationStore();
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
        setDisable(false);
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
  switch (props.network.chain_type) {
    case "cosmos": {
      return calculateCosmosFee(coin);
    }
    case "evm": {
      return calculateEvmFee(coin);
    }
  }
}

function calculateCosmosFee(coin: Coin) {
  const asset = AssetUtils.getCurrencyByDenom(coin.denom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    asset.ibcData,
    asset.shortName,
    asset.decimal_digits
  );
}

function calculateEvmFee(coin: Coin) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    coin.denom,
    coin.denom,
    (props.network as EvmNetwork).nativeCurrency.decimals
  );
}
</script>
<style lang="scss" scoped>
@keyframes spin {
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}

.loader-animate {
  animation: spin 0.8s linear infinite;
}
</style>
