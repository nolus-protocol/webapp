<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header">
      <button
        class="back-arrow"
        type="button"
        v-on:click="modelValue.onConfirmBackClick"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5"/>
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
        id="password"
        :error-msg="modelValue.passwordErrorMsg"
        :is-error="modelValue.passwordErrorMsg !== ''"
        :value="modelValue.password"
        label="Password"
        name="password"
        type="password"
        @input="(event) => (modelValue.password = event.target.value)"
      ></InputField>
    </div>

    <div
      class="block bg-light-grey radius-rounded p-4 text-left break-words mt-nolus-255"
    >
      <div class="block">
        <p class="nls-14 nls-font-400 text-primary m-0">Contract address:</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ modelValue.contractAddress }}
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
import { LeaseComponentProps } from '@/components/LeaseComponents/LeaseFormComponent.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import { assetInfo } from '@/config/assetInfo'

export default defineComponent({
  name: 'LeaseConfirmComponent',
  components: {
    ArrowLeftIcon,
    InputField
  },
  props: {
    modelValue: {
      type: Object as PropType<LeaseComponentProps>
    }
  },
  methods: {
    formatAmount (value: string, selectedCurrency: AssetBalance) {
      const denom = assetInfo[selectedCurrency.balance.denom].coinDenom
      return value + ' ' + denom
    },
    isMnemonicWallet () {
      return WalletUtils.isConnectedViaMnemonic()
    }
  }
})
</script>
