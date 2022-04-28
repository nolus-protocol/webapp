<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block py-3 px-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium">
      Current balance:

      <a
        href="#"
        class="text-secondary text-bold underline ml-2"
      >
        {{ formatCurrentBalance(currentBalance) }}
      </a>
    </div>

    <div class="block text-left">
      <div class="block mt-4">
        <CurrencyField
          name="amount"
          id="amount"
          label="Amount"
          :value="amount"
          @input='$emit("update:amount", $event.target.value)'
          :currency-options="currentBalance"
          :option="selectedCurrency"
          @update-currency="onUpdateCurrency"
          :error-msg="amountErrorMsg"
          :is-error="amountErrorMsg !== ''"
        />
      </div>

      <div class="block mt-4">
        <PickerDefault
          label="Network"
          :options="[{value: 2, label: 'NLS'},{value: 0, label: 'ETH'}, {value: 1, label: 'BTC'}]"
          :disabled="true"
        ></PickerDefault>
      </div>

      <div class="block mt-4">
        <InputField
          type="text"
          name="sendTo"
          id="sendTo"
          label="Send to"
          :value="receiverAddress"
          @input='$emit("update:receiverAddress", $event.target.value)'
          :error-msg="receiverErrorMsg"
          :is-error="receiverErrorMsg !== ''"
        />
      </div>

      <div class="block mt-4">
        <InputField
          type="text"
          name="memo"
          id="memo"
          label="Memo (optional)"
          :value="memo"
          @input='$emit("update:memo", $event.target.value)'
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
    <button class="btn btn-primary btn-large-primary" v-on:click="onNextClick">
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

export default defineComponent({
  name: 'SendComponent',
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField
  },
  props: {
    currentBalance: {
      type: Array as PropType<AssetBalance[]>
    },
    selectedCurrency: {
      type: Object as PropType<AssetBalance>
    },
    amount: {
      type: String,
      default: ''
    },
    memo: {
      type: String
    },
    receiverAddress: {
      type: String
    },
    password: {
      type: String
    },
    onNextClick: {
      type: Function
    },
    onSendClick: {
      type: Function
    },
    onConfirmBackClick: {
      type: Function
    },
    onClickOkBtn: {
      type: Function
    },
    receiverErrorMsg: {
      type: String
    },
    amountErrorMsg: {
      type: String
    }
  },
  methods: {
    formatCurrentBalance (value: AssetBalance[]) {
      if (value) {
        return CurrencyUtils.convertUNolusToNolus(value[0]?.balance.amount.toString()).toString()
      }
    },
    onUpdateCurrency (value: AssetBalance) {
      this.$emit('update:selectedCurrency', value)
    }
  }
})
</script>

<style scoped>

</style>
