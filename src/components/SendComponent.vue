<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block py-3 px-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium">
      Current balance:

      <a
        href="#"
        class="text-secondary text-bold underline ml-2"
      >
        {{ formatCurrentBalance(modelValue.currentBalance) }}
      </a>
    </div>

    <div class="block text-left">
      <div class="block mt-4">
        <CurrencyField
          name="amount"
          id="amount"
          label="Amount"
          :value="modelValue.amount"
          @input="(event) => (modelValue.amount = event.target.value)"
          :currency-options="modelValue.currentBalance"
          :option="modelValue.selectedCurrency"
          @update-currency="onUpdateCurrency"
          :disabled-currency-picker="true"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
        />
      </div>

      <div class="block mt-4">
        <PickerDefault
          label="Network"
          :default-option="{label: 'NLS', value: 'NLS'}"
          :options="[{value: 'NLS', label: 'NLS'},{value: 'ETH', label: 'ETH'}, {value: 'BTC', label: 'BTC'}]"
          :disabled="true"
        ></PickerDefault>
      </div>

      <div class="block mt-4">
        <InputField
          type="text"
          name="sendTo"
          id="sendTo"
          label="Send to"
          :value="modelValue.receiverAddress"
          @input="(event) => (modelValue.receiverAddress = event.target.value)"
          :error-msg="modelValue.receiverErrorMsg"
          :is-error="modelValue.receiverErrorMsg !== ''"
        />
      </div>

      <div class="block mt-4">
        <InputField
          type="text"
          name="memo"
          id="memo"
          label="Memo (optional)"
          :value="modelValue.memo"
          @input="(event) => (modelValue.memo = event.target.value)"
        ></InputField>

        <div class="block mt-2">
          <button class="btn btn-secondary btn-medium-secondary btn-icon ml-auto mr-0 flex items-center">
            <StarIcon class="inline-block icon w-4 h-4 mr-1"/>
            Save as contact
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button class="btn btn-primary btn-large-primary" v-on:click="modelValue.onNextClick">
      Next
    </button>
  </div>
</template>

<script lang="ts">
import { StarIcon } from '@heroicons/vue/solid'
import CurrencyField from '@/components/CurrencyField.vue'
import PickerDefault from '@/components/PickerDefault.vue'
import InputField from '@/components/InputField.vue'
import { defineComponent, PropType } from 'vue'
import { CurrencyUtils } from '@/utils/CurrencyUtils'
import { AssetBalance } from '@/store/modules/wallet/state'

export interface SendComponentProps {
  receiverErrorMsg: string,
  amountErrorMsg: string,
  currentBalance: AssetBalance[],
  selectedCurrency: AssetBalance,
  amount: string,
  memo: string,
  receiverAddress: string,
  password: string,
  txHash: string,
  onNextClick: () => void,
  onSendClick: () => void,
  onConfirmBackClick: () => void,
  onClickOkBtn: () => void,
}

export default defineComponent({
  name: 'SendComponent',
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>
    }
  },

  methods: {
    formatCurrentBalance (value: AssetBalance[]) {
      if (value) {
        return CurrencyUtils.convertUNolusToNolus(
          value[0]?.balance.amount.toString()
        ).toString()
      }
    },
    onUpdateCurrency (value: AssetBalance) {
      this.$emit('update:modelValue.selectedCurrency', value)
    }
  }
})
</script>
