<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border">
    <div class="navigation-header wrap">
      <XIcon class="h-14 w-14 radius-circle p-2 error-icon"/>
      <h1 class="text-large-heading text-center text-primary w-full mt-3">Sending failed</h1>
      <h2 class="text-small-heading text-center text-primary text-regular w-full mt-1">Something went wrong</h2>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0">
    <div class="block bg-light-grey radius-rounded p-4 text-left break-words">
      <div class="block">
        <p class="text-normal-copy text-primary m-0">Send to:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ modelValue.receiverAddress }}</p>
      </div>

      <div class="block mt-3">
        <p class="text-normal-copy text-primary m-0">Memo:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ modelValue.memo }}</p>
      </div>

      <div class="block mt-3">
        <p class="text-normal-copy text-primary m-0">Amount:</p>
        <p class="text-normal-copy text-primary text-bold m-0">{{ formatAmount(modelValue.amount) }}</p>
      </div>

      <div class="block mt-3">
        <p class="text-normal-copy text-primary m-0">Tx Id:</p>
        <p class="text-normal-copy text-primary text-bold m-0">C1FAC987E9515B…63BE5162B4A00310244A</p>
        <button class="btn btn-secondary btn-medium-secondary btn-icon mt-2">
          <DuplicateIcon class="icon w-4 h-4"/>
          Copy
        </button>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button class="btn btn-primary btn-large-primary btn-auto" v-on:click="modelValue.onClickOkBtn">
      Ok
    </button>
  </div>
</template>

<script lang="ts">
import { DuplicateIcon, XIcon } from '@heroicons/vue/solid'
import { defineComponent, PropType } from 'vue'
import { CurrencyUtils } from '@/utils/CurrencyUtils'
import { SendComponentProps } from '@/components/SendComponent.vue'

export default defineComponent({
  name: 'SendingFailedComponent',
  components: {
    XIcon,
    DuplicateIcon
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
    }
  }
})
</script>
