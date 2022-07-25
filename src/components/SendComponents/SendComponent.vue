<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="block py-3 px-4 bg-light-grey radius-light text-left nls-14 nls-font-400 text-primary"
    >
      Current balance:

      <a class="text-secondary nls-font-700 underline ml-2" href="#">
        {{ formatCurrentBalance(modelValue.selectedCurrency) }}
      </a>
    </div>

    <div class="block text-left">
      <div class="block mt-nolus-255">
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

      <div class="block mt-nolus-255">
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

      <div class="block mt-nolus-255">
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

      <div class="block mt-nolus-255">
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

export interface SendComponentProps {
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

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
    console.log('mounted::: ', this.modelValue)
    this.addressOptions = [
      {
        id: '1',
        value: 'nolus1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3rtesmj',
        label: 'Silviya Stancheva’s Binance'
      },
      {
        id: '2',
        value: 'nolus1tygms3xhhs3yv487phx3dw4a95jn7t7lht9pdx',
        label: 'Petar Petrov KuCoin'
      },
      {
        id: '3',
        value: 'nolus1vnn8pr2hqrm64mge8724jmzcm7usnsm5e4qqle',
        label: 'Gancho Manev Binance'
      },
      {
        id: '4',
        value: 'nolus10d07y265gmmuvt4z0w9aw880jnsr700jvjr65k',
        label: 'Gero Nikolov’s Ledger'
      },
      {
        id: '5',
        value: 'nolus1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8305rt6',
        label: 'Silviya Stancheva’s Binance'
      }
    ]
  },
  emits: ['update:modelValue.selectedCurrency'],
  methods: {
    formatCurrentBalance (selectedCurrency: AssetBalance) {
      if (selectedCurrency) {
        const asset = assetsInfo[selectedCurrency.balance.denom]
        return CurrencyUtils.convertMinimalDenomToDenom(
          selectedCurrency.balance.amount.toString(), selectedCurrency.balance.denom, asset.coinDenom, asset.coinDecimals
        ).toString()
      }
    }
  }
})
</script>
