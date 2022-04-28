<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header">
      <button
        type="button"
        class="back-arrow"
        v-on:click="currentComponent.onConfirmBackClick"
      >
        <ArrowLeftIcon class="h-5 w-5" aria-hidden="true"/>
      </button>
      <h1 class="text-large-heading text-center text-primary">Confirm sending</h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div class="block text-left">
      <InputField
        type="password"
        name="password"
        id="password"
        label="Password"
        :value="currentComponent.password"
        @input="(event) => (currentComponent.password = event.target.value)"
      ></InputField>
    </div>

    <div class="block bg-light-grey radius-rounded p-4 text-left break-words mt-4">
      <div class="block">
        <p class="text-normal-copy text-primary m-0">Send to:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ currentComponent.receiverAddress }}</p>
      </div>

      <div class="block mt-3">
        <p class="text-normal-copy text-primary m-0">Memo:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ currentComponent.memo }}</p>
      </div>

      <div class="block mt-3">
        <p class="text-normal-copy text-primary m-0">Amount:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ formatAmount(currentComponent.amount) }}</p>
      </div>

      <div class="block mt-3">
        <p class="text-normal-copy text-primary m-0">Tax & Fee:</p>
        <p class="text-normal-copy text-primary text-bold m-0">0.000094 NOMO</p>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button class="btn btn-primary btn-large-primary" v-on:click="currentComponent.onSendClick">
      Send
    </button>
  </div>
</template>

<script lang="ts">
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import InputField from '@/components/InputField.vue'
import { defineComponent, PropType } from 'vue'
import { CurrencyUtils } from '@/utils/CurrencyUtils'
import { BaseSendType } from './types/baseSend.type'
import { AssetBalance } from '@/store'

export type SendConfirmComponentProps = {
  currentBalance: AssetBalance[],
  selectedCurrency: AssetBalance,
  amount: string,
  memo: string,
  receiverAddress: string,
  password: string,
  onNextClick: () => void,
  onSendClick: () => void,
  onConfirmBackClick: () => void,
  onClickOkBtn: () => void
}


export default defineComponent({
  name: 'SendingConfirmComponent',
  components: {
    ArrowLeftIcon,
    InputField
  },
  props: {
    currentComponent: {
       type: Object as PropType<SendConfirmComponentProps>,
    }
  },
  methods: {
    formatAmount (value: string) {
      const amountInUNls = CurrencyUtils.convertNolusToUNolus(value)
      return CurrencyUtils.convertUNolusToNolus(amountInUNls.amount.toString())
    }
  }
})
</script>
