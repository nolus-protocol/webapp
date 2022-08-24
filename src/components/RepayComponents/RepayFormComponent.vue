<template>
  <div class="block text-left px-10 mt-10">
    <div
      class="block nls-balance mb-[13px] bg-light-grey radius-light text-left text-primary"
    >
      Current balance:

      <a class="text-secondary nls-font-700 underline ml-2" href="#">
        $36,423.02
      </a>
    </div>
    <CurrencyField
      id="repayBalance"
      label="Balance To Repay"
      name="repayBalance"
      :value="modelValue.amount"
      :step="'1'"
      @input="(event) => (modelValue.amount = event.target.value)"
      :currency-options="modelValue.currentBalance"
      :option="modelValue.selectedCurrency"
      @update-currency="(event) => (modelValue.selectedCurrency = event)"
      :error-msg="modelValue.amountErrorMsg"
      :is-error="modelValue.amountErrorMsg !== ''"
    />
    <div class="flex w-full">
      <div class="grow-3 text-right nls-font-500 text-14">
        <p class="mb-3 mt-[25px] mr-5">Repayment Amount:</p>
        <p class="mb-3 mr-5">Outstanding Lease:</p>
      </div>
      <div class="text-right nls-font-700 text-14">
        <p
          class="mb-3 mt-[25px] flex justify-end align-center mr-[5px]"
        >
          {{
            calculateBalance(
              modelValue.amount,
              modelValue.selectedCurrency?.balance?.denom
            )
          }}
          <TooltipComponent content="Content goes here "/>
        </p>
        <p class="mb-3 flex justify-end align-center mr-[5px]">
          {{
            calculateBalance(
              modelValue.outstandingLoanAmount.amount,
              modelValue.outstandingLoanAmount.denom
            )
          }}
          <TooltipComponent content="Content goes here"/>
        </p>
      </div>
    </div>
  </div>
  <div class="modal-send-receive-actions mt-5">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick"
    >
      Repay
    </button>
  </div>
</template>

<script lang="ts">
import CurrencyField from '@/components/CurrencyField.vue'
import { defineComponent, PropType } from 'vue'
import { useStore } from '@/store'
import { assetsInfo } from '@/config/assetsInfo'
import { Coin, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@nolus/nolusjs'
import TooltipComponent from '@/components/TooltipComponent.vue'
import { RepayComponentProps } from '@/types/component/RepayComponentProps'

export default defineComponent({
  name: 'RepayFormComponent',
  components: {
    CurrencyField,
    TooltipComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<RepayComponentProps>,
      required: true
    }
  },
  data () {
    return {
      disabledInputField: true
    }
  },
  mounted () {
    console.log(this.modelValue)
  },

  methods: {
    calculateBalance (tokenAmount: string, denom: string) {
      console.log('amount: ', tokenAmount)
      console.log('denom: ', denom)
      const prices = useStore().getters.getPrices
      const assetInf = assetsInfo[denom]
      if (prices && assetInf) {
        const coinPrice = prices[assetInf.coinDenom]?.amount || '0'
        const tokenDecimals = assetInf.coinDecimals
        const coinAmount = new Coin(denom, new Int(tokenAmount || '0'))
        return CurrencyUtils.calculateBalance(
          coinPrice,
          coinAmount,
          0
        ).toString()
      }

      return '0'
    }
  }
})
</script>
