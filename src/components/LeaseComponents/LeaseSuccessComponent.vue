<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header wrap">
      <CheckIcon class="h-14 w-14 radius-circle p-2 success-icon"/>
      <h1 class="nls-font-700 nls-32 text-center text-primary w-full mt-3">
        {{ $t('message.sending-successful') }}
      </h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div class="block bg-light-grey radius-rounded p-4 text-left break-words">
      <div class="block">
        <p class="nls-14 nls-font-400 text-primary m-0">{{ $t('message.contract-address') }}</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ modelValue.contractAddress }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">{{ $t('message.memo') }}</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ modelValue.memo }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">{{ $t('message.amount') }}</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ formatAmount(modelValue.amount) }}
        </p>
      </div>

      <div class="block mt-3">
        <p class="nls-14 nls-font-400 text-primary m-0">{{ $t('message.tx-id') }}</p>
        <p class="nls-14 nls-font-400 text-primary nls-font-700 m-0">
          {{ modelValue.txHash }}
        </p>
        <button
          class="btn btn-secondary btn-medium-secondary btn-icon mt-2"
          v-on:click="btnCopyClick"
        >
          <DuplicateIcon class="icon w-4 h-4"/>
          {{ $t('message.copy') }}
        </button>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary btn-auto"
      v-on:click="modelValue.onClickOkBtn"
    >
      {{ $t('message.ok') }}
    </button>
  </div>
</template>

<script lang="ts">
import { CheckIcon, DuplicateIcon } from '@heroicons/vue/solid'
import { defineComponent, PropType } from 'vue'
import { StringUtils } from '@/utils/StringUtils'
import { CurrencyUtils } from '@nolus/nolusjs'
import { LeaseComponentProps } from '@/components/LeaseComponents/LeaseFormComponent.vue'

export default defineComponent({
  name: 'LeaseSuccessComponent',
  components: {
    CheckIcon,
    DuplicateIcon
  },
  props: {
    modelValue: {
      type: Object as PropType<LeaseComponentProps>
    }
  },
  methods: {
    formatAmount (value: string) {
      const amountInUNls = CurrencyUtils.convertNolusToUNolus(value)
      return CurrencyUtils.convertUNolusToNolus(amountInUNls.amount.toString())
    },
    btnCopyClick () {
      console.log('copy!')
      StringUtils.copyToClipboard(this.modelValue?.txHash || '')
    }
  }
})
</script>
