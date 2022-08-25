<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header">
      <button
        v-if="isStepConfirm"
        class="back-arrow"
        type="button"
        v-on:click="onBackButtonClick"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5"/>
      </button>
      <div class="flex flex-col justify-center items-center">
        <CheckIcon v-if="isStepSuccess" class="h-14 w-14 radius-circle p-2 success-icon mb-2"/>
        <XIcon v-if="isStepError" class="h-14 w-14 radius-circle p-2 error-icon mb-2"/>
        <h1 class="nls-font-700 text-28 md:text-32 text-center text-primary">
          {{ step }}
        </h1>
      </div>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div class="block bg-light-grey radius-rounded p-4 text-left break-words mt-[25px]">
      <div class="block">
        <p class="text-14 nls-font-400 text-primary m-0">{{ txType }}</p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ receiverAddress }}
        </p>
      </div>

      <div v-if="memo" class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">Memo:</p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ memo }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">Amount:</p>
        <p class="text-14 text-primary nls-font-700 m-0">

          {{ formatAmount(amount) }}
        </p>
      </div>

      <div v-if="txHash" class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">Tx Hash:</p>
        <p class="text-14 text-primary nls-font-700 m-0">{{ txHash }}</p>
      </div>
      <div v-else class="block mt-3">
        <p class="text-14 nls-font-400 text-primary m-0">Tax & Fee:</p>
        <p class="text-14 text-primary nls-font-700 m-0">0.000094 NOMO</p>
      </div>
    </div>

    <div v-if="isStepConfirm && isMnemonicWallet()" class="block text-left mt-3">
      <InputField
        id="password"
        :value="password"
        label="Password"
        name="password"
        type="password"
        @input="(event: Event) => $emit('passwordUpdate', (event.target as HTMLInputElement).value)"
      >
      </InputField>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      :class="`btn btn-primary btn-large-primary ${isStepPending ? 'js-loading' : ''}`"
      v-on:click="btnAction">
      {{ isStepConfirm ? 'Confirm' : 'Ok' }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed, defineEmits, defineProps, inject, onMounted } from 'vue'
import { ArrowLeftIcon, CheckIcon, XIcon } from '@heroicons/vue/solid'
import { CurrencyUtils } from '@nolus/nolusjs'

import InputField from '@/components/InputField.vue'
import { WalletUtils } from '@/utils/WalletUtils'
import { assetsInfo } from '@/config/assetsInfo'
import { AssetBalance } from '@/store/modules/wallet/state'
import { TxType } from '@/types/TxType'
import { CONFIRM_STEP } from '@/types/ConfirmStep'

interface Props {
  selectedCurrency: AssetBalance
  receiverAddress: string
  password: string
  amount: string
  memo?: string
  txType: TxType
  txHash: string
  step: CONFIRM_STEP
  onSendClick: () => void
  onBackClick: () => void
  onOkClick: () => void
}

const props = defineProps<Props>()

const isStepConfirm = computed(() => props.step === CONFIRM_STEP.CONFIRM)
const isStepPending = computed(() => props.step === CONFIRM_STEP.PENDING)
const isStepSuccess = computed(() => props.step === CONFIRM_STEP.SUCCESS)
const isStepError = computed(() => props.step === CONFIRM_STEP.ERROR)
const btnAction = computed(() => isStepConfirm.value ? props.onSendClick : props.onOkClick)

defineEmits(['passwordUpdate'])

const setShowDialogHeader = inject('setShowDialogHeader', (n: boolean) => {
})

onMounted(() => {
  setShowDialogHeader(false)
})

function onBackButtonClick () {
  setShowDialogHeader(true)
  props.onBackClick()
}

function formatAmount (value: string) {
  const selectedCurrency = props.selectedCurrency
  if (!selectedCurrency) {
    return
  }

  const {
    coinDenom,
    coinMinimalDenom,
    coinDecimals
  } = assetsInfo[selectedCurrency.balance.denom]

  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(value, coinMinimalDenom, coinDecimals)
  return CurrencyUtils.convertMinimalDenomToDenom(minimalDenom.amount.toString(), coinMinimalDenom, coinDenom, coinDecimals)
}

function isMnemonicWallet () {
  return WalletUtils.isConnectedViaMnemonic()
}
</script>
