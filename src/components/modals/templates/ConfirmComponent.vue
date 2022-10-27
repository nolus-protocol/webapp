<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header">
      <button
        v-if="isStepConfirm"
        class="back-arrow"
        type="button"
        @click="onBackButtonClick"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5" />
      </button>
      <div class="flex flex-col justify-center items-center">
        <CheckIcon
          v-if="isStepSuccess"
          class="h-14 w-14 radius-circle p-2 success-icon mb-2"
        />
        <XMarkIcon
          v-if="isStepError"
          class="h-14 w-14 radius-circle p-2 error-icon mb-2"
        />
        <h1 class="nls-font-700 text-28 md:text-32 text-center text-primary">
          {{ step }}
        </h1>
      </div>
    </div>
  </div>

  <div class="separator-line pb-6 relative z-[200000] w-[516px]"></div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div
      class="block bg-light-grey radius-rounded p-4 text-left break-words mt-[25px]"
    >
      <div class="block">
        <p class="text-14 nls-font-400 text-primary m-0">{{ txType }}</p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ receiverAddress }}
        </p>
      </div>

      <div v-if="memo" class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">{{ $t('message.memo') }}:</p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ memo }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">{{ $t('message.amount') }}</p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ formatAmount(amount) }}
        </p>
      </div>

      <div v-if="txHash" class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">{{ $t('message.tx-hash') }}:</p>
        <p class="text-14 text-primary nls-font-700 m-0">{{ txHash }}</p>
      </div>
      <div v-else class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">{{ $t('message.tx-and-fee') }}:</p>
        <p class="text-14 text-primary nls-font-700 m-0">{{ FEE }} NLS</p>
      </div>
    </div>

    <div
      v-if="isStepConfirm && isMnemonicWallet()"
      class="block text-left mt-3"
    >
      <InputField
        id="password"
        :value="password"
        label="Password"
        name="password"
        type="password"
        :error-msg="errorMessage"
        :is-error="errorMessage !== ''"
        @input="(event: Event) => $emit('passwordUpdate', (event.target as HTMLInputElement).value)"
      >
      </InputField>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      :class="`btn btn-primary btn-large-primary ${
        isStepPending ? 'js-loading' : ''
      }`"
      @click="btnAction"
    >
      {{ isStepConfirm ?  $t('message.confirm') :  $t('message.ok') }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import InputField from '@/components/InputField.vue';
import type { AssetBalance } from '@/stores/wallet/state';

import { computed, inject, onMounted, ref } from 'vue';
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/solid';
import { CurrencyUtils } from '@nolus/nolusjs';
import { WalletUtils } from '@/utils';
import { assetsInfo } from '@/config/assetsInfo';
import { TxType, CONFIRM_STEP } from '@/types';
import { useI18n } from 'vue-i18n';
import { FEE } from '@/config/wallet';

const errorMessage = ref('');
const i18n = useI18n();

interface Props {
  selectedCurrency: AssetBalance;
  receiverAddress: string;
  password: string;
  amount: string;
  memo?: string;
  txType: TxType;
  txHash: string;
  step: CONFIRM_STEP;
  onSendClick: () => void;
  onBackClick: () => void;
  onOkClick: () => void;
}

defineEmits(['passwordUpdate']);

const props = defineProps<Props>();
const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM);
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING);
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS);
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR);
const btnAction = computed(() => {
  if(props.password.length == 0 && isMnemonicWallet()){
    errorMessage.value = i18n.t('message.empty-password');
    return;
  }
  return isStepConfirm.value ? props.onSendClick : props.onOkClick;
});


const setShowDialogHeader = inject('setShowDialogHeader', (n: boolean) => {});

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

  const { coinDenom, coinMinimalDenom, coinDecimals } =
    assetsInfo[selectedCurrency.balance.denom];

  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    value,
    coinMinimalDenom,
    coinDecimals
  );
  return CurrencyUtils.convertMinimalDenomToDenom(
    minimalDenom.amount.toString(),
    coinMinimalDenom,
    coinDenom,
    coinDecimals
  );
}

function isMnemonicWallet() {
  return WalletUtils.isConnectedViaMnemonic();
}
</script>
