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
        <h1 class="text-center text-28 font-semibold text-neutral-typography-200 md:text-32">
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
      <div class="radius-rounded mt-[25px] block break-words bg-dialogs-swap-color p-4 text-left">
        <div class="block">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.proposal") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            {{ proposal }}
          </p>
        </div>

        <div class="mt-3 block">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ txType }}</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            <template v-if="vote == VoteOption.VOTE_OPTION_YES">
              {{ $t("message.yes") }}
            </template>

            <template v-if="vote == VoteOption.VOTE_OPTION_NO">
              {{ $t("message.no") }}
            </template>

            <template v-if="vote == VoteOption.VOTE_OPTION_ABSTAIN">
              {{ $t("message.abstained") }}
            </template>
            <template v-if="vote == VoteOption.VOTE_OPTION_NO_WITH_VETO">
              {{ $t("message.veto") }}
            </template>
          </p>
        </div>

        <div class="mt-3 block">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.voter") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            {{ receiverAddress }}
          </p>
        </div>

        <div
          v-if="txHash"
          class="mt-3 block"
        >
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.tx-hash") }}:</p>
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
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.tx-and-fee") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">~{{ calculateFee(fee) }}</p>
        </div>
      </div>
    </div>

    <NotificationBox
      v-if="isStepConfirm"
      :type="NotificationBoxType.warning"
      class="mx-[38px] mb-[20px]"
    >
      <template v-slot:content>
        {{ $t("message.amount-warning") }}
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
import type { Coin } from "@cosmjs/amino";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, StringUtils } from "@/common/utils";
import { CONFIRM_STEP } from "@/common/types";
import { useApplicationStore } from "@/common/stores/application";
import { NotificationBox, NotificationBoxType } from "web-components";

const applicaton = useApplicationStore();

interface Props {
  receiverAddress: string;
  txType: string;
  txHash: string;
  step: CONFIRM_STEP;
  fee?: Coin;
  proposal: string;
  vote: VoteOption | null;
  onSendClick: () => void;
  onBackClick: () => void;
  onOkClick: () => void;
}

const props = defineProps<Props>();
const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM);
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING);
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS);
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR);
const isStepCustomError = computed(() => props.step === CONFIRM_STEP.GasErrorExternal);
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
