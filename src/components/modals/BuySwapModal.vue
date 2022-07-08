<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[99] modal-send-receive-parent"
    @click="$emit('close-modal')"
  >
    <button class="btn-close-modal" @click="$emit('close-modal')">
      <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg"/>
    </button>

    <div
      class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
      @click.stop
    >
      <!-- Header -->
      <div class="flex modal-send-receive-header">
        <button>Swap</button>
        <button class="active">Buy</button>
      </div>

      <!-- Input Area -->
      <div class="modal-send-receive-input-area">
        <div
          class="flex items-center box box-warning radius-rounded p-4 mt-nolus-255 text-left break-words"
        >
          <div class="inline-block mr-2">
            <img
              class="block mx-auto my-0 w-5 h-5"
              src="@/assets/icons/info.svg"
            />
          </div>
          <div class="block grow-1">
            <p class="text-left text-primary nls-14 nls-font-400">
              Send only <span class="nls-font-700">WBTC</span> to this deposit
              address.
            </p>
            <p class="text-left text-primary nls-14 nls-font-400">
              Ensure the network is
              <span class="nls-font-700">Ethereum (ERC20)</span>.
            </p>
          </div>
        </div>

        <div class="block text-left">
          <div class="block mt-nolus-255">
            <MultipleCurrencyField
              id="multiple-currency-field-example"
              label="Multiple Currency Field Example"
              name="multiple-currency-field-example"
            ></MultipleCurrencyField>
          </div>
        </div>

        <div class="flex justify-end mt-5">
          <p
            class="inline-block m-0 text-left text-primary nls-14 nls-font-400"
          >
            1 BTC price in USD:
            <span class="inline-block nls-font-700 ml-5">$37,274.98</span>
          </p>
        </div>
        <div class="flex justify-end mt-3">
          <p
            class="inline-block m-0 text-left text-primary nls-14 nls-font-400"
          >
            Ramp fee:
            <span class="inline-block nls-font-700 ml-5">-$2.49</span>
          </p>
        </div>
        <div class="flex justify-end mt-3">
          <p
            class="inline-block m-0 text-left text-primary nls-14 nls-font-400"
          >
            Network fees:
            <span class="inline-block nls-font-700 ml-5">-$0.09233</span>
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-send-receive-actions">
        <button class="btn btn-primary btn-large-primary">
          Buy BTC with USD
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import MultipleCurrencyField from '@/components/MultipleCurrencyField.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'BuySwapModal',
  components: {
    MultipleCurrencyField
  },
  props: {
    tryButton: {
      type: Function
    }
  }
})
</script>
