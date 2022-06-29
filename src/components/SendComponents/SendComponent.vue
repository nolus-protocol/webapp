<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="block py-3 px-4 bg-light-grey radius-light text-left nls-14 nls-font-400 text-primary"
    >
      Current balance:

      <a href="#" class="text-secondary nls-font-700 underline ml-2">
        {{ formatCurrentBalance(modelValue.currentBalance) }}
      </a>
    </div>

    <div class="block text-left">
      <div class="block mt-nolus-255">
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

      <div class="block mt-nolus-255">
        <PickerDefault
          label="Network"
          :default-option="{ label: 'NLS', value: 'NLS' }"
          :options="[
            { value: 'NLS', label: 'NLS' },
            { value: 'ETH', label: 'ETH' },
            { value: 'BTC', label: 'BTC' },
          ]"
          :disabled="true"
        ></PickerDefault>
      </div>

      <div class="block mt-nolus-255">
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
          type="text"
          name="memo"
          id="memo"
          label="Memo (optional)"
          :value="modelValue.memo"
          @input="(event) => (modelValue.memo = event.target.value)"
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
    <button
      class="btn btn-primary btn-large-primary"
      v-on:click="modelValue.onNextClick"
    >
      Next
    </button>
  </div>
</template>

<script lang="ts">
import { StarIcon } from "@heroicons/vue/solid";
import CurrencyField from "@/components/CurrencyField.vue";
import PickerDefault, {
  PickerDefaultOption,
} from "@/components/PickerDefault.vue";
import InputField from "@/components/InputField.vue";
import { defineComponent, PropType } from "vue";
import { AssetBalance } from "@/store/modules/wallet/state";
import { CurrencyUtils } from "@nolus/nolusjs";
import PickerCombo from "@/components/PickerCombo.vue";

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
  name: "SendComponent",
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField,
    PickerCombo,
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>,
    },
  },
  data() {
    return {
      addressOptions: [] as PickerDefaultOption[],
    };
  },
  mounted() {
    this.addressOptions = [
      {
        id: "1",
        value: "nolus1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3rtesmj",
        label: "Silviya Stancheva’s Binance",
      },
      {
        id: "2",
        value: "nolus1tygms3xhhs3yv487phx3dw4a95jn7t7lht9pdx",
        label: "Petar Petrov KuCoin",
      },
      {
        id: "3",
        value: "nolus1vnn8pr2hqrm64mge8724jmzcm7usnsm5e4qqle",
        label: "Gancho Manev Binance",
      },
      {
        id: "4",
        value: "nolus10d07y265gmmuvt4z0w9aw880jnsr700jvjr65k",
        label: "Gero Nikolov’s Ledger",
      },
      {
        id: "5",
        value: "nolus1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8305rt6",
        label: "Silviya Stancheva’s Binance",
      },
    ];
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
      this.$emit("update:modelValue.selectedCurrency", value);
    },
  },
});
</script>
