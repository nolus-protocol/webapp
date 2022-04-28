<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="block py-3 px-4 bg-light-grey radius-light text-left text-normal-copy text-primary text-medium"
    >
      Current balance:

      <a href="#" class="text-secondary text-bold underline ml-2">
        {{ formatCurrentBalance(currentComponent.currentBalance) }}
      </a>
    </div>

    <div class="block text-left">
      <div class="block mt-4">
        <CurrencyField
          name="amount"
          id="amount"
          label="Amount"
          :value="currentComponent.amount"
          @input="(event) => (currentComponent.amount = event.target.value)"
          :currency-options="currentComponent.currentBalance"
          :option="currentComponent.selectedCurrency"
          @update-currency="currentComponent.onUpdateCurrency"
          :error-msg="currentComponent.amountErrorMsg"
          :is-error="currentComponent.amountErrorMsg !== ''"
        />
      </div>

      <div class="block mt-4">
        <PickerDefault
          label="Network"
          :options="[
            { value: 2, label: 'NLS' },
            { value: 0, label: 'ETH' },
            { value: 1, label: 'BTC' },
          ]"
          :disabled="true"
        ></PickerDefault>
      </div>

      <div class="block mt-4">
        <InputField
          type="text"
          name="sendTo"
          id="sendTo"
          label="Send to"
          :value="currentComponent.receiverAddress"
          @input="
            (event) => (currentComponent.receiverAddress = event.target.value)
          "
          :error-msg="currentComponent.receiverErrorMsg"
          :is-error="currentComponent.receiverErrorMsg !== ''"
        />
      </div>

      <div class="block mt-4">
        <InputField
          type="text"
          name="memo"
          id="memo"
          label="Memo (optional)"
          :value="currentComponent.memo ?? ''"
          @input="(event) => (currentComponent.memo = event.target.value)"
        ></InputField>

        <div class="block mt-2">
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon ml-auto mr-0 flex items-center"
          >
            <StarIcon class="inline-block icon w-4 h-4 mr-1" />
            Save as contact
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button class="btn btn-primary btn-large-primary" v-on:click="currentComponent.onNextClick">
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

export type SendComponentProps = {
  receiverErrorMsg?: string,
  amountErrorMsg?: string,
  currentBalance: AssetBalance[],
    selectedCurrency: AssetBalance,
    amount: string,
    memo: string,
    receiverAddress: string,
    password: string,
    onNextClick: () => void,
    onSendClick: () => void,
    onConfirmBackClick: () => void,
    onClickOkBtn: () => void
}
export default defineComponent({
  name: "SendComponent",
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField,
  },
  props: {
    currentComponent: {
      type: Object as PropType<SendComponentProps>,
    }
  },

  methods: {
    formatCurrentBalance(value: AssetBalance[]) {
      if (value) {
        return CurrencyUtils.convertUNolusToNolus(
          value[0]?.balance.amount.toString()
        ).toString();
      }
    },
    onUpdateCurrency(value: AssetBalance) {
      this.$emit("update:currentComponent.selectedCurrency", value);
    },
  },
});
</script>

<style scoped></style>
