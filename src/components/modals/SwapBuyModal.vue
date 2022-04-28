<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99] modal-send-receive-parent"
    @click="$emit('close-modal')">

    <button
      class="btn-close-modal"
      @click="$emit('close-modal')"
    >
      <img
        src="@/assets/icons/cross.svg"
        class="inline-block w-4 h-4"
      />
    </button>

    <div class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
         @click.stop>

      <!-- Header -->
      <div class="flex modal-send-receive-header">
        <button class="active">Swap</button>
        <button>Buy</button>
      </div>

      <!-- Input Area -->
      <div class="modal-send-receive-input-area">
        <div class="block py-3 px-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium">
          Current balance:

          <a
            href="#"
            class="text-secondary text-bold underline ml-2"
          >
            125 ETH
          </a>
        </div>

        <div class="block text-left">
          <div class="block mt-4">
            <MultipleCurrencyField
              name="multiple-currency-field-example"
              id="multiple-currency-field-example"
              label="Multiple Currency Field Example"
            ></MultipleCurrencyField>
          </div>
        </div>

        <div class="flex justify-end mt-5">
          <p class="inline-block m-0 text-left text-primary text-normal-copy">
            Minimum received:
            <span
              class="inline-block text-bold ml-5"
            >0.456232 ETH</span>
          </p>
        </div>
        <div class="flex justify-end mt-3">
          <p class="inline-block m-0 text-left text-primary text-normal-copy">
            TX fee:
            <span
              class="inline-block text-bold ml-5"
            >0.09233 ETH</span>
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-send-receive-actions">
        <button class="btn btn-primary btn-large-primary">
          Swap ETH for BTC
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import MultipleCurrencyField from '@/components/MultipleCurrencyField.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SwapBuyModal',
  components: {
    // CheckIcon,
    // StarIcon,
    MultipleCurrencyField
  },
  props: {
    tryButton: {
      type: Function
    }
  }
})
</script>
