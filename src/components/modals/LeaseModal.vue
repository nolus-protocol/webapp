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
        <div class="navigation-header">
          <h1 class="block w-full text-large-heading text-left text-primary">Lease</h1>
        </div>
      </div>

      <!-- Input Area -->
      <div class="modal-send-receive-input-area">
        <div class="block text-left">
          <div class="block">
            <CurrencyField
              name="amountInvestment"
              id="amount-investment"
              label="How much do you want to invest?"
            ></CurrencyField>
          </div>

          <div class="block mt-4">
            <CurrencyField
              name="amountInterest"
              id="amount-interest"
              label="Get up to:"
            ></CurrencyField>
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
            Leased amount:
            <span
              class="inline-block text-bold ml-5"
            >
                $24,585.00
                <img
                  :src="require('@/assets/icons/tooltip.svg')"
                  width="12"
                  height="12"
                  class="inline-block m-0 ml-1"
                />
              </span>
          </p>
        </div>
        <div class="flex justify-end mt-3">
          <p class="inline-block m-0 text-left text-primary text-normal-copy">
            Daily interest:
            <span
              class="inline-block text-bold ml-5"
            >
                0.0263%
                <img
                  :src="require('@/assets/icons/tooltip.svg')"
                  width="12"
                  height="12"
                  class="inline-block m-0 ml-1"
                />
              </span>
          </p>
        </div>
        <div class="flex justify-end mt-3">
          <p class="inline-block m-0 text-left text-primary text-normal-copy">
            Liquidation price:
            <span
              class="inline-block text-bold ml-5"
            >
                $18,585.00
                <img
                  :src="require('@/assets/icons/tooltip.svg')"
                  width="12"
                  height="12"
                  class="inline-block m-0 ml-1"
                />
              </span>
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-send-receive-actions">
        <button class="btn btn-primary btn-large-primary">
          Lease
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { CheckIcon, StarIcon } from '@heroicons/vue/solid'
import CurrencyField from '@/components/CurrencyField.vue'
import PickerDefault from '@/components/PickerDefault.vue'
import PickerCombo from '@/components/PickerCombo.vue'
import InputField from '@/components/InputField.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'LeaseModal',
  components: {
    CheckIcon,
    StarIcon,
    CurrencyField,
    PickerDefault,
    PickerCombo,
    InputField
  },
  props: {
    tryButton: {
      type: Function
    }
  }
})
</script>
