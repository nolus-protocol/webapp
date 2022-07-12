<template>
  <div class="block text-left px-10 mt-nolus-41">
    <div
      class="block nls-balance mb-nolus-13 bg-light-grey radius-light text-left text-primary"
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
      <div class="grow-3 text-right nls-font-500 nls-14">
        <p class="mb-nolus-12 mt-nolus-255 mr-nolus-20">Repayment Amount:</p>
        <p class="mb-nolus-12 mr-nolus-20">Outstanding Lease:</p>
      </div>
      <div class="text-right nls-font-700 nls-14">
        <p
          class="mb-nolus-12 mt-nolus-255 flex justify-end align-center mr-nolus-5"
        >
          {{
            calculateBalance(
              modelValue.amount,
              modelValue.selectedCurrency?.balance?.denom
            )
          }}
          <TooltipComponent content="Content goes here "/>
        </p>
        <p class="mb-nolus-12 flex justify-end align-center mr-nolus-5">
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
  <div class="modal-send-receive-actions mt-nolus-20">
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
import { AssetBalance } from '@/store/modules/wallet/state'
import { useStore } from '@/store'
import { assetsInfo } from '@/config/assetsInfo'
import { Coin, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@nolus/nolusjs'
import { Asset } from '@nolus/nolusjs/build/contracts'
import TooltipComponent from '@/components/TooltipComponent.vue'

export interface RepayComponentProps {
  outstandingLoanAmount: Asset;
  amountErrorMsg: string;
  passwordErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

export default defineComponent({
  name: 'RepayFormComponent',
  components: {
    CurrencyField,
    TooltipComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<RepayComponentProps>
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
  watch: {
    // 'modelValue.leaseApply' () {
    //   this.disabledInputField = !this.modelValue?.leaseApply
    // }
  },
  computed: {},
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
