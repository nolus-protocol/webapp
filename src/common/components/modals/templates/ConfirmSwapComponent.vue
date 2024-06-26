<template>
  <!-- Header -->
  <div class="flex">
    <div class="flex w-full flex-col items-center justify-center">
      <CheckIcon
        v-if="isStepSuccess"
        class="mb-2 h-14 w-14 rounded-full bg-success-50 p-2 text-success-100"
      />
      <XMarkIcon
        v-if="isStepError"
        class="mb-2 h-14 w-14 rounded-full bg-danger-50 p-2 text-danger-100"
      />
      <h1
        class="w-full border-b-[1px] border-border-color pb-5 text-center text-28 font-semibold text-neutral-typography-200 md:text-32"
      >
        {{ $t(`message.${step}`) }}
      </h1>
    </div>
  </div>

  <div
    v-if="isStepSuccess"
    class="mt-6 flex flex-col gap-6"
  >
    <div class="block break-words rounded-lg bg-dialogs-swap-color p-[24px] text-center text-neutral-typography-200">
      {{ $t("message.swap-success") }}
    </div>
    <div class="flex gap-8">
      <Button
        :label="$t('message.ok')"
        class="flex-1"
        severity="primary"
        size="large"
        @click="onOkClick"
      />
    </div>
  </div>

  <div
    v-if="isStepError"
    class="mt-6 flex flex-col gap-6"
  >
    <div class="block break-words rounded-lg bg-dialogs-swap-color p-[24px] text-center text-neutral-typography-200">
      {{ errorMsg }}
    </div>
    <Button
      :label="$t('message.close')"
      severity="primary"
      size="large"
      @click="onOkClick"
    />
  </div>

  <form
    v-if="isStepConfirm || isStepPending"
    class="mt-6 flex flex-col gap-6"
    @submit.prevent="onSendClick"
  >
    <!-- Input Area -->
    <div class="">
      <div class="radius-rounded block break-words bg-dialogs-swap-color py-4 text-left">
        <div class="block px-4">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.from") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">{{ swapAmount }}</p>
          <p class="m-0 text-14 font-normal text-neutral-typography-200">
            {{ fromAddress }}
          </p>
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ fromNetwork }}</p>
        </div>

        <div class="mt-3 block px-4">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ txType }}</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">{{ forAmount }}</p>
          <p class="m-0 text-14 font-normal text-neutral-typography-200">
            {{ receiverAddress }}
          </p>
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ toNetwork }}</p>
        </div>

        <div
          v-if="isStepConfirm"
          class="mt-3 block px-4"
        >
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.tx-and-fee") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">~{{ calculateFee(fee) }}</p>
        </div>

        <template v-if="isStepPending">
          <span class="border-swap mt-3 block border-t"> </span>
          <div
            v-for="item in txs"
            :key="item"
            class="block"
          >
            <p class="m-0 p-4 pb-0 text-14 font-normal capitalize text-neutral-typography-200">
              {{ $t("message.transaction") }} {{ item }}:
            </p>

            <template v-if="txHashes[item - 1]">
              <a
                :href="`${applicaton.network.networkAddresses.explorer}/${txHashes[item - 1].hash}`"
                class="his-url m-0 flex items-center justify-between px-4 text-14 font-medium"
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
              <p class="m-0 px-4 text-14 font-semibold text-neutral-typography-200">{{ $t("message.Pending") }}</p>
            </template>
          </div>
        </template>
      </div>
    </div>

    <NotificationBox type="warning">
      <template v-slot:content>
        <template v-if="isStepPending">
          <span class="text-neutral-typography-200">
            {{ $t("message.swap-warning") }}
            <RouterLink
              class="text-primary-50"
              to="/history"
              @click="onClose"
              >{{ $t("message.history-page") }}</RouterLink
            >
          </span>
        </template>
        <span
          v-else
          class="text-neutral-typography-200"
          v-html="
            $t('message.swap-confirm-warning', {
              txs: `${txs} ${txs > 1 ? $t('message.transactions') : $t('message.transaction')}`
            })
          "
        ></span>
      </template>
    </NotificationBox>

    <!-- Actions -->
    <div class="">
      <Button
        :label="isStepConfirm ? $t('message.confirm') : $t('message.ok')"
        :loading="isStepPending"
        class="w-full"
        severity="primary"
        size="large"
        type="submit"
      />
    </div>
  </form>
</template>

<script lang="ts" setup>
import { Button, NotificationBox } from "web-components";

import type { Coin } from "@cosmjs/amino";
import { SwapStatus } from "../swap/types";
import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils } from "@/common/utils";
import { CONFIRM_STEP } from "@/common/types";
import { useApplicationStore } from "@/common/stores/application";

interface Props {
  fromAddress: string;
  receiverAddress: string;
  fromNetwork: string;
  toNetwork: string;
  txType: string;
  txHashes: { hash: string; status: SwapStatus }[];
  swapAmount: string;
  forAmount: string;
  step: CONFIRM_STEP;
  errorMsg: string;
  fee: Coin;
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

const applicaton = useApplicationStore();
const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (n: boolean) => {});
const onClose = inject("onClose", (n: boolean) => {});

onMounted(() => {
  setShowDialogHeader(false);
  setDisabled();
});

watch(
  () => props.step,
  () => {
    setDisabled();
  }
);

function setDisabled() {
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
      setDisable(false);
      break;
    }
    default: {
      setDisable(false);
      break;
    }
  }
}

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
