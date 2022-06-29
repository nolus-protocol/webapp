<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="flex items-center box box-warning radius-rounded p-4 mb-nolus-24 text-left break-words"
    >
      <div class="inline-block mr-2">
        <img src="@/assets/icons/info.svg" class="block mx-auto my-0 w-5 h-5" />
      </div>
      <div class="block box box-warning grow-1">
        <p class="text-left nls-14 nls-font-400">
          Send only <span class="nls-font-700">WBTC</span> to this deposit
          address. Ensure the network is
          <span class="nls-font-700">Ethereum (ERC20)</span>
        </p>
      </div>
    </div>
    <div class="block text-left">
      <!-- <DynamicForm :formValue="formDataModel" /> -->
      <!-- <DynamicForm :formValue="formDataModel" /> -->
      <MultipleCurrencyField
        name="multiple-currency-field-example"
        id="multiple-currency-field-example"
        label="Multiple Currency Field Example"
      ></MultipleCurrencyField>
      <div class="flex w-full mt-nolus-255">
        <div class="grow-3 text-right nls-font-500 nls-14">
          <p class="mb-nolus-12 mr-nolus-20">1 BTC price in USD::</p>
          <p class="mb-nolus-12 mr-nolus-20">Ramp fee:</p>
          <p class="mr-nolus-20">Network fees:</p>
        </div>
        <div class="text-right nls-font-700 nls-14">
          <p class="mb-nolus-12">$37,274.98</p>
          <p class="mb-nolus-12">-$2.49</p>
          <p>-$0.09233</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick"
    >
      Buy BTC with USD
    </button>
  </div>
</template>

<script lang="ts">
import { StarIcon } from "@heroicons/vue/solid";
import CurrencyField from "@/components/CurrencyField.vue";
import PickerDefault from "@/components/PickerDefault.vue";
import InputField from "@/components/InputField.vue";
import { defineComponent, PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetBalance } from "@/store/modules/wallet/state";
import TooltipComponent from "@/components/TooltipComponent.vue";

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
  name: "BuyComponent",
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField,
    TooltipComponent,
  },
  props: {
    modelValue: {
      type: Object as PropType<SendComponentProps>,
    },
  },
  data() {
    return {
      //  formDataModel: [] as DynamicFormProps[],
    };
  },
  mounted() {
    // this.formDataModel = [
    //   {
    //     formFields: [
    //       {
    //         fieldType: "multipleCurrencyField",
    //         inputType: "number",
    //         className: "block currency-field-container",
    //         label: "",
    //         nameSecondary: "secondary",
    //       },
    //     ],
    //   },
    // ];
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
