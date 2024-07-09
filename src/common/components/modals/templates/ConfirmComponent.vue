<template>
  <div class="px-10 pb-6 pt-2.5">
    <!-- Header -->
    <div class="mb-6 flex w-full justify-center border-b-[1px] border-border-color pb-5">
      <div class="flex w-full flex-col items-center justify-center">
        <CheckIcon
          v-if="isStepSuccess"
          class="mb-2 h-14 w-14 rounded-full bg-success-50 p-2 text-success-100"
        />
        <XMarkIcon
          v-if="isStepError || isStepCustomError"
          class="mb-2 h-14 w-14 rounded-full bg-danger-50 p-2 text-danger-100"
        />
        <h1
          class="block w-full text-center text-28 font-semibold leading-7 text-neutral-typography-200 md:text-32 md:leading-8"
        >
          {{ $t(`message.${step}`) }}
        </h1>
      </div>
    </div>

    <div
      v-if="isStepCustomError"
      class=""
    >
      <div class="block break-words rounded-lg bg-dialogs-swap-color p-[24px] text-center text-neutral-typography-200">
        {{ $t("message.gassErrorMsg") }}
      </div>
      <div class="">
        <Button
          :label="$t('message.close')"
          class="mt-6 w-full"
          severity="primary"
          size="large"
          @click="btnAction"
        />
      </div>
    </div>
    <form
      v-else
      class="flex flex-col gap-4"
      @submit.prevent="btnAction"
    >
      <div class="block break-words rounded-lg bg-light-grey p-4 text-left">
        <div class="block">
          <p class="text-14 font-normal text-neutral-typography-200">{{ txType }}</p>
          <p class="text-14 font-semibold text-neutral-typography-200">
            {{ receiverAddress }}
          </p>
        </div>

        <div
          v-if="memo"
          class="mt-3 block"
        >
          <p class="text-14 font-normal text-neutral-typography-200">{{ $t("message.memo") }}:</p>
          <p class="text-14 font-semibold text-neutral-typography-200">
            {{ memo }}
          </p>
        </div>

        <div class="mt-3 block">
          <p class="text-14 font-normal text-neutral-typography-200">
            {{ $t("message.amount") }}
          </p>
          <p class="text-14 font-semibold text-neutral-typography-200">
            {{ formatAmount(amount) }}
          </p>
        </div>

        <div
          v-if="txHash"
          class="mt-3 block"
        >
          <p class="text-14 font-normal text-neutral-typography-200">{{ $t("message.tx-hash") }}:</p>
          <a
            :href="`${applicaton.network.networkAddresses.explorer}/${txHash}`"
            class="text-primary-50 text-14"
            target="_blank"
          >
            {{ StringUtils.truncateString(txHash, 6, 6) }}
          </a>
        </div>
        <div
          v-if="fee"
          class="mt-3 block"
        >
          <p class="text-14 font-normal text-neutral-typography-200">{{ $t("message.tx-and-fee") }}:</p>
          <p class="text-14 font-semibold text-neutral-typography-200">~{{ calculateFee(fee) }}</p>
        </div>
      </div>

      <NotificationBox
        v-if="isStepConfirm"
        :type="NotificationBoxType.warning"
      >
        <template v-slot:content>
          {{ $t("message.amount-warning") }}
        </template>
      </NotificationBox>

      <Button
        :label="isStepConfirm ? $t('message.confirm') : $t('message.ok')"
        :loading="isStepPending"
        class="mt-8 w-full"
        severity="primary"
        size="large"
        type="submit"
      />
    </form>
  </div>
</template>

<script lang="ts" setup>
import type { Coin } from "@cosmjs/amino";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { computed, inject, onMounted, watch } from "vue";
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, StringUtils } from "@/common/utils";
import { CONFIRM_STEP, type ExternalCurrency } from "@/common/types";
import { useApplicationStore } from "@/common/stores/application";
import { Button, NotificationBox, NotificationBoxType } from "web-components";

interface Props {
  selectedCurrency: ExternalCurrency | AssetBalance;
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

const applicaton = useApplicationStore();
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

function formatAmount(value: string) {
  const selectedCurrency = props.selectedCurrency;

  if (!selectedCurrency) {
    return;
  }

  const asset = AssetUtils.getCurrencyByDenom(selectedCurrency.balance.denom);

  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(value, asset.ibcData, asset.decimal_digits);
  return CurrencyUtils.convertMinimalDenomToDenom(
    minimalDenom.amount.toString(),
    asset.ibcData,
    asset.shortName,
    asset.decimal_digits
  );
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
