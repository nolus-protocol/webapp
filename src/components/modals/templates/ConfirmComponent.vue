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
      <div class="flex flex-col justify-center items-center">
        <CheckIcon v-if="step===3" class="h-14 w-14 radius-circle p-2 success-icon mb-2"/>
        <XIcon v-if="step===4" class="h-14 w-14 radius-circle p-2 error-icon mb-2"/>
        <h1 class="nls-font-700 nls-32 text-center text-primary">
          {{ title }}
        </h1>
      </div>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div v-if="isMnemonicWallet()" class="block text-left">
      <InputField
        id="password"
        :value="modelValue.password"
        label="Password"
        name="password"
        type="password"
        @input="(event) => (modelValue.password = event.target.value)"
      ></InputField>
    </div>

    <div class="block bg-light-grey radius-rounded p-4 text-left break-words mt-nolus-255">
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
          <<<<<<< HEAD
          {{ formatAmount(modelValue.amount) }}
          =======
          {{ formatAmount(modelValue.amount) }}
          >>>>>>> 4fd8da4 (fix success and error ui)
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
      v-on:click="modelValue.onSendClick">
      {{ btnContent }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { ArrowLeftIcon, CheckIcon } from '@heroicons/vue/solid'
import { CurrencyUtils } from '@nolus/nolusjs'
import InputField from '@/components/InputField.vue'
import { SendComponentProps } from '@/components/SendComponents/SendComponent.vue'
import { WalletUtils } from '@/utils/WalletUtils'
import { assetsInfo } from '@/config/assetsInfo'

enum ParentComponent {
  SEND = 'SendMainComponent',
  REPAY = 'RepayMainComponent'
}

export default defineComponent({
  name: 'ConfirmComponent',
  components: {
    ArrowLeftIcon,
    InputField,
    CheckIcon
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>
    },
    step: {
      type: Number
    }
  },
  data () {
    return {
      title: 'Confirm sending',
      btnContent: 'Send',
      parentComponentName: ''
    }
  },
  mounted () {
    this.$emit('defaultState', true)
    this.parentComponentName = ParentComponent.SEND || ParentComponent.REPAY
  },
  computed: {
    getStep () {
      return this.step
    }
  },
  watch: {
    'step' () {
      this.title = this.step === 2 ? 'Confirm Sending' : (this.step === 3 ? 'Sending successful' : 'Error')
      this.btnContent = this.step === 2 ? 'Send' : 'Ok'
    }
  },
  methods: {
    formatAmount (value: string) {
      const selectedCurrency = this.modelValue?.selectedCurrency
      if (selectedCurrency) {
        const {
          coinDenom,
          coinMinimalDenom,
          coinDecimals
        } = assetsInfo[selectedCurrency.balance.denom]

        const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(value, coinMinimalDenom, coinDecimals)
        return CurrencyUtils.convertMinimalDenomToDenom(minimalDenom.amount.toString(), coinMinimalDenom, coinDenom, coinDecimals)
      }
    },
    isMnemonicWallet () {
      return WalletUtils.isConnectedViaMnemonic()
    }
  }
})
</script>
