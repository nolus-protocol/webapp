<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header">
      <button
        type="button"
        class="back-arrow"
        v-on:click="modelValue.onConfirmBackClick"
      >
        <ArrowLeftIcon class="h-5 w-5" aria-hidden="true"/>
      </button>
      <h1 class="nls-font-700 nls-32 text-center text-primary">
        Confirm sending
      </h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div v-if="isMnemonicWallet()" class="block text-left">
      <InputField
        type="password"
        name="password"
        id="password"
        label="Password"
        :value="modelValue.password"
        @input="(event) => (modelValue.password = event.target.value)"
      ></InputField>
    </div>

    <div
      class="block bg-light-grey radius-rounded p-4 text-left break-words mt-nolus-255"
    >
      <div class="block">
        <p class="nls-14 nls-font-400 text-primary m-0">Send to:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">
          {{ modelValue.receiverAddress }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Memo:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">
          {{ modelValue.memo }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Amount:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">
          {{ formatAmount(modelValue.amount) }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Tax & Fee:</p>
        <p class="nls-14 text-primary nls-font-700 m-0">0.000094 NOMO</p>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary"
      v-on:click="modelValue.onSendClick"
    >
      Send
    </button>
  </div>
</template>

<script lang="ts">
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import InputField from '@/components/InputField.vue'
import { defineComponent, PropType } from 'vue'
import { SendComponentProps } from '@/components/SendComponents/SendComponent.vue'
import { WalletUtils } from '@/utils/WalletUtils'
import { CurrencyUtils } from '@nolus/nolusjs'

export default defineComponent({
  name: 'SendingConfirmComponent',
  components: {
    ArrowLeftIcon,
    InputField
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>
    }
  },
  methods: {
    formatAmount (value: string) {
      const amountInUNls = CurrencyUtils.convertNolusToUNolus(value)
      return CurrencyUtils.convertUNolusToNolus(amountInUNls.amount.toString())
    },
    isMnemonicWallet () {
      return WalletUtils.isConnectedViaMnemonic()
    }
  }
})
</script>
