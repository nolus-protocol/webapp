<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="block py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
    >
      Current balance:

      <a class="text-secondary nls-font-700 underline ml-2" href="#">
        {{ formatCurrentBalance(modelValue.selectedCurrency) }}
      </a>
    </div>

    <div class="block text-left">
      <div class="block mt-[25px]">
        <CurrencyField
          id="amount"
          :currency-options="modelValue.currentBalance"
          :disabled-currency-picker="false"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          label="Amount"
          name="amount"
          @input="(event) => (modelValue.amount = event.target.value)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
      </div>

      <div class="block mt-[25px]">
        <Picker
          :default-option="{ label: 'NLS', value: 'NLS' }"
          :disabled="true"
          :options="[
            { value: 'NLS', label: 'NLS' },
            { value: 'ETH', label: 'ETH' },
            { value: 'BTC', label: 'BTC' },
          ]"
          label="Network"
        />
      </div>

      <div class="block mt-[25px]">
        <InputField
          id="sendTo"
          :error-msg="modelValue.receiverErrorMsg"
          :is-error="modelValue.receiverErrorMsg !== ''"
          :value="modelValue.receiverAddress"
          label="Send to"
          name="sendTo"
          type="text"
          @input="(event) => (modelValue.receiverAddress = event.target.value)"
        />
        <!--    <PickerCombo
          name="sendTo"
          id="sendTo"
          label="Send to"
          value="modelValue.receiverAddress"
          :options="addressOptions"
        /> -->
      </div>

      <div class="block mt-[25px]">
        <InputField
          id="memo"
          :value="modelValue.memo"
          label="Memo (optional)"
          name="memo"
          type="text"
          @input="(event) => (modelValue.memo = event.target.value)"
        ></InputField>

        <div class="block mt-2">
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon ml-auto mr-0 flex items-center"
          >
            <StarIcon class="inline-block icon w-4 h-4 mr-1"/>
            Save as contact
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary"
      v-on:click="modelValue.onNextClick"
    >
      Next
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { CurrencyUtils } from '@nolus/nolusjs'

import CurrencyField from '@/components/CurrencyField.vue'
import Picker, { PickerOption } from '@/components/Picker.vue'
import InputField from '@/components/InputField.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import { assetsInfo } from '@/config/assetsInfo'
import { SendComponentProps } from '@/types/component/SendComponentProps'

export default defineComponent({
  name: 'SendComponent',
  components: {
    StarIcon,
    CurrencyField,
    Picker,
    InputField
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>,
      default: {} as object
    }
  },
  data () {
    return {
      addressOptions: [] as PickerOption[]
    }
  },
  mounted () {
  },
  emits: ['update:modelValue.selectedCurrency'],
  methods: {
    formatCurrentBalance (selectedCurrency: AssetBalance) {
      if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
        const asset = assetsInfo[selectedCurrency.balance.denom]
        return CurrencyUtils.convertMinimalDenomToDenom(
          selectedCurrency.balance.amount.toString(), selectedCurrency.balance.denom, asset.coinDenom, asset.coinDecimals
        ).toString()
      }
    }
  }
})
</script>
