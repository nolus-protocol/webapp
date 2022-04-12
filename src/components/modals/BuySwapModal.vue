<template>
  <div class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99] modal-send-receive-parent"
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
            <button>Swap</button>
            <button class="active">Buy</button>
        </div>

        <!-- Input Area -->
        <div class="modal-send-receive-input-area">
          <div class="flex items-center box box-warning radius-rounded p-4 mt-4 text-left break-words">
            <div class="inline-block mr-2">
              <img
                src="@/assets/icons/info.svg"
                class="block mx-auto my-0 w-5 h-5"
              />
            </div>
            <div class="block grow-1">
              <p class="text-left text-primary text-normal-copy">Send only <span class="text-bold">WBTC</span> to this deposit address.</p>
              <p class="text-left text-primary text-normal-copy">Ensure the network is <span class="text-bold">Ethereum (ERC20)</span>.</p>
            </div>
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
              1 BTC price in USD:
              <span
                class="inline-block text-bold ml-5"
              >$37,274.98</span>
            </p>
          </div>
          <div class="flex justify-end mt-3">
            <p class="inline-block m-0 text-left text-primary text-normal-copy">
              Ramp fee:
              <span
                class="inline-block text-bold ml-5"
              >-$2.49</span>
            </p>
          </div>
          <div class="flex justify-end mt-3">
            <p class="inline-block m-0 text-left text-primary text-normal-copy">
              Network fees:
              <span
                class="inline-block text-bold ml-5"
              >-$0.09233</span>
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

<script>
import { CheckIcon, StarIcon } from '@heroicons/vue/solid'
import MultipleCurrencyField from '@/components/MultipleCurrencyField.vue'

export default {
  name: 'BuySwapModal',
  components: {
    CheckIcon,
    StarIcon,
    MultipleCurrencyField
  },
  props: {
    tryButton: {
      type: Function
    }
  }
}
</script>
