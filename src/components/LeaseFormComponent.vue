<template>
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
    <button class="btn btn-primary btn-large-primary" v-on:click="modelValue.onNextClick">
      Lease
    </button>
  </div>
</template>

<script lang="ts">
import CurrencyField from '@/components/CurrencyField.vue'
import { defineComponent, PropType } from 'vue'
import { SendComponentProps } from '@/components/SendComponent.vue'

export default defineComponent({
  name: 'LeaseFormComponent',
  components: {
    CurrencyField
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>
    }
  },
  mounted () {
    console.log(this.modelValue)
  }
})
</script>
