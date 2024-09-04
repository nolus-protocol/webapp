<template>
  <!-- Header -->
  <div
    :class="{ 'no-border': !isStepCustomError }"
    class="modal-send-receive-header flex"
  >
    <div class="navigation-header">
      <button
        v-if="isStepConfirm"
        class="back-arrow"
        type="button"
        @click="onBackButtonClick"
      >
        <ArrowLeftIcon
          aria-hidden="true"
          class="h-5 w-5"
        />
      </button>
      <div class="flex flex-col items-center justify-center">
        <CheckIcon
          v-if="isStepSuccess"
          class="radius-circle success-icon mb-2 h-14 w-14 p-2"
        />
        <XMarkIcon
          v-if="isStepError || isStepCustomError"
          class="radius-circle error-icon mb-2 h-14 w-14 p-2"
        />
        <h1
          v-if="isStepCustomError"
          class="text-center text-28 font-semibold text-neutral-typography-200 md:text-32"
        >
          {{ $t(`message.${step}`, { symbol: networkSymbol }) }}
        </h1>
        <h1
          v-else
          class="text-center text-28 font-semibold text-neutral-typography-200 md:text-32"
        >
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
      {{ $t("message.gassErrorExternalMsg", { symbol: networkSymbol }) }}
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
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ txType }}</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            {{ receiverAddress }}
          </p>
        </div>

        <div
          v-if="memo"
          class="mt-3 block"
        >
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.memo") }}:</p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            {{ memo }}
          </p>
        </div>

        <div class="mt-3 block">
          <p class="m-0 text-14 font-normal text-neutral-typography-200">
            {{ $t("message.amount") }}
          </p>
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            {{ formatAmount(amount) }}
          </p>
        </div>

        <div
          v-if="txHash"
          class="mt-3 block"
        >
          <p class="m-0 text-14 font-normal text-neutral-typography-200">{{ $t("message.tx-hash") }}:</p>
          <a
            :href="`${networkData.explorer}/${txHash}`"
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
          <p class="m-0 text-14 font-semibold text-neutral-typography-200">
            {{ calculateFee() }}
          </p>
        </div>
      </div>
    </div>

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

import { computed, inject, onMounted, watch } from "vue";
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, StringUtils } from "@/common/utils";
import { CONFIRM_STEP, NetworkTypes, type ExternalCurrency } from "@/common/types";
import { NETWORK_DATA } from "@/networks";
import type { AssetBalance } from "@/common/stores/wallet/types";

interface Props {
  selectedCurrency: ExternalCurrency | AssetBalance;
  receiverAddress: string;
  amount: string;
  networkKey: string;
  memo?: string;
  txType: string;
  txHash: string;
  step: CONFIRM_STEP;
  fee?: Coin;
  networkSymbol?: string;
  networkType: NetworkTypes;
  networkCurrencies?: {
    [key: string]: {
      name: string;
      symbol: string;
      decimal_digits: string;
      decimals: number;
      ibc_route: string[];
      ticker: string;
      icon: string;
    };
  };
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

const networkData = computed(() => {
  return NETWORK_DATA.supportedNetworks[props.networkKey];
});

const networkSymbol = computed(() => {
  return AssetUtils.getCurrencyByTicker(props.networkSymbol as string);
});

const btnAction = computed(() => {
  return isStepConfirm.value ? props.onSendClick : props.onOkClick;
});

const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (n: boolean) => {});

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

onMounted(() => {
  setShowDialogHeader(false);
});

function onBackButtonClick() {
  setShowDialogHeader(true);
  props.onBackClick();
}

function formatAmount(value: string) {
  const selectedCurrency = props.selectedCurrency;

  if (!selectedCurrency) {
    return;
  }

  const coinMinimalDenom = getMinimalDenom();
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    value,
    coinMinimalDenom,
    selectedCurrency.decimal_digits!
  );

  return CurrencyUtils.convertMinimalDenomToDenom(
    minimalDenom.amount.toString(),
    coinMinimalDenom,
    selectedCurrency.shortName!,
    selectedCurrency.decimal_digits!
  );
}

function calculateFee() {
  switch (props.networkType) {
    case NetworkTypes.cosmos: {
      return calculateFeeCosmos();
    }
    case NetworkTypes.evm: {
      return calculateFeeEvm();
    }
  }
}

function calculateFeeCosmos() {
  const currency = props.networkCurrencies?.[networkData.value.ticker]!;
  return CurrencyUtils.convertMinimalDenomToDenom(
    props.fee!.amount.toString(),
    props.selectedCurrency.balance.denom,
    props.networkSymbol as string,
    Number(currency.decimal_digits ?? currency.decimals)
  );
}

function calculateFeeEvm() {
  return CurrencyUtils.convertMinimalDenomToDenom(
    props.fee!.amount.toString(),
    props.fee!.denom,
    props.networkSymbol as string,
    props.selectedCurrency.decimal_digits!
  );
}

function getMinimalDenom() {
  const selectedCurrency = props.selectedCurrency;

  switch (props.networkType) {
    case NetworkTypes.cosmos: {
      const coinMinimalDenom = selectedCurrency.balance.denom;
      return coinMinimalDenom;
    }
    case NetworkTypes.evm: {
      return selectedCurrency.balance.denom;
    }
  }
}
</script>
