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
        <h1 class="text-center text-28 font-semibold text-neutral-typography-200 md:text-32">
          {{ $t(`message.${step}`) }}
        </h1>
      </div>
    </div>
  </div>

  <div
    v-if="isStepSuccess"
    class="modal-form"
  >
    <div
      class="radius-rounded mx-[24px] my-[24px] block break-words bg-light-grey p-[24px] text-center text-neutral-typography-200"
    >
      {{ $t("message.swap-success") }}
    </div>
    <div class="flex gap-8 px-[24px] pb-[28px]">
      <button
        class="btn btn-primary btn-large-primary w-full"
        @click="onOkClick"
      >
        {{ $t("message.ok") }}
      </button>
    </div>
  </div>

  <div
    v-if="isStepError"
    class="modal-form overflow-auto"
  >
    <div
      class="radius-rounded mx-[24px] my-[24px] block break-words bg-light-grey p-[24px] text-center text-neutral-typography-200"
    >
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
        <div class="mb-4 block px-4">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.from") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">{{ amount }}</p>
          <p class="m-0 text-14 font-normal text-neutral-typography-200">
            {{ fromAddress }}
          </p>
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ fromNetwork }}</p>
        </div>

        <div class="block px-4">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ txType }}</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">{{ swapToAmount }}</p>
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
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">~{{ fee }}</p>
        </div>

        <template v-if="isStepPending">
          <div
            v-for="item in txs"
            v-bind:key="item"
            class="block"
          >
            <p class="m-0 p-4 pb-0 text-14 font-normal capitalize text-neutral-typography-200">
              {{ $t("message.transaction") }} {{ item }}:
            </p>

            <template v-if="txHashes[item - 1]">
              <a
                :href="`${txHashes[item - 1].url ?? applicaton.network.networkAddresses.explorer}/${txHashes[item - 1].hash}`"
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
    <NotificationBox
      v-if="isStepConfirm && (warning.length > 0 || txs > 1)"
      :type="NotificationBoxType.warning"
      class="mx-[18px] mb-[4px] lg:mx-[38px] lg:mb-[20px]"
    >
      <template v-slot:content>
        <span
          class="text-neutral-typography-200"
          v-html="
            $t('message.swap-confirm-warning', {
              txs: `${txs} ${txs > 1 ? $t('message.transactions') : $t('message.transaction')}`
            })
          "
        >
        </span>
        <span class="text-neutral-typography-200">.&#160;{{ warning }} </span>
      </template>
    </NotificationBox>

    <NotificationBox
      v-if="isStepPending"
      :type="NotificationBoxType.warning"
      class="mx-[18px] mb-[4px] lg:mx-[38px] lg:mb-[20px]"
    >
      <template v-slot:content>
        <span class="text-neutral-typography-200">
          {{ $t("message.swap-warning") }}
          <RouterLink
            class="text-primary-50"
            to="/history"
            @click="onClose"
            >{{ $t("message.history-page") }}</RouterLink
          ></span
        >
      </template>
    </NotificationBox>
    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button :class="`btn btn-primary btn-large-primary ${isStepPending ? 'js-loading' : ''}`">
        {{ isStepConfirm ? $t("message.confirm") : $t("message.ok") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { SwapStatus } from "../swap/types";
import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { StringUtils } from "@/common/utils";
import { CONFIRM_STEP } from "@/common/types";
import { useApplicationStore } from "@/common/stores/application";
import type { EvmNetwork, Network } from "@/common/types/Network";
import { NotificationBox, NotificationBoxType } from "web-components";

interface Props {
  fromAddress: string;
  receiverAddress: string;
  fromNetwork: string;
  toNetwork: string;
  txType: string;
  txHashes: { hash: string; status: SwapStatus; url: string | null }[];
  amount: string;
  swapToAmount: string;
  step: CONFIRM_STEP;
  errorMsg: string;
  warning: string;
  fee: string;
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
