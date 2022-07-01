<template>
  <div
    class="fixed flex modal items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99]"
    @click="$emit('close-modal')"
  >
    <div
      class="text-center modal bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal"
      @click.stop
    >
      <button class="btn-close-modal" @click="$emit('close-modal')">
        <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg"/>
      </button>
      <div class="flex modal-header">
        <p class="nls-32 nls-font-700">Repay</p>
      </div>

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
          @update-currency="
            (event) => (modelValue.selectedDownPaymentCurrency = event)
          "
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
        />
        <div class="flex w-full">
          <div class="grow-3 text-right nls-font-500 nls-14">
            <p class="mb-nolus-12 mt-nolus-255 mr-nolus-20">
              Repayment Amount:
            </p>
            <p class="mb-nolus-12 mr-nolus-20">Outstanding Lease:</p>
          </div>
          <div class="text-right nls-font-700 nls-14">
            <p class="mb-nolus-12 mt-nolus-255 flex justify-end align-center">
              $1,112.00
              <TooltipComponent content="Content goes here"/>
            </p>
            <p class="mb-nolus-12 flex justify-end align-center">
              $35,311.00
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
    </div>
  </div>
</template>

<script lang="ts">
import CurrencyField from '@/components/CurrencyField.vue'
import { defineComponent, PropType } from 'vue'
import { AssetBalance } from '@/store/modules/wallet/state'

export interface RepayComponentProps {
  amountErrorMsg: string;
  passwordErrorMsg: string
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
    CurrencyField
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
  methods: {}

})
</script>
