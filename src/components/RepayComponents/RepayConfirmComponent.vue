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
        :error-msg="modelValue.passwordErrorMsg"
        :is-error="modelValue.passwordErrorMsg !== ''"
        :value="modelValue.password"
        @input="(event) => (modelValue.password = event.target.value)"
      ></InputField>
    </div>

    <div
      class="block bg-light-grey radius-rounded p-4 text-left break-words mt-nolus-255"
    >
      <div class="block">
        <p class="nls-14 nls-font-400 text-primary m-0">Contract address:</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ modelValue.receiverAddress }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Memo:</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ modelValue.memo }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Amount:</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ formatAmount(modelValue.amount, modelValue.selectedCurrency) }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">Tax & Fee:</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          0.000094 NOMO
        </p>
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
import { WalletUtils } from '@/utils/WalletUtils'
import { RepayComponentProps } from '@/components/RepayComponents/RepayFormComponent.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import { assetsInfo } from '@/config/assetsInfo'

export default defineComponent({
  name: 'RepayConfirmComponent',
  components: {
    ArrowLeftIcon,
    InputField
  },
  props: {
    modelValue: {
      type: Object as PropType<RepayComponentProps>
    }
  },
  methods: {
    formatAmount (value: string, selectedCurrency: AssetBalance) {
      const denom = assetsInfo[selectedCurrency.balance.denom].coinDenom
      return value + ' ' + denom
    },
    isMnemonicWallet () {
      return WalletUtils.isConnectedViaMnemonic()
    }
  }
})
</script>
