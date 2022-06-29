<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="bg-light-grey radius-light text-left text-primary flex items-center nls-balance"
    >
      <span class="nls-14 nls-font-500">Expected APY:</span>
      <span class="nls-14 nls-font-700"> 24%</span>
      <!-- tooltip-->
      <div
        class="relative flex flex-col items-center icon-tooltip group group-tooltip"
      >
        <div
          class="absolute bottom-0 flex flex-col items-center hidden mb-7 group-hover:flex"
        >
          <span
            class="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-black shadow-lg"
            >A top aligned tooltip.</span
          >
          <div
            class="absolute w-3 h-3 -mt-2 rotate-45 bg-black"
            style="background: #000; bottom: -4px"
          ></div>
        </div>
      </div>
      <!-- /tooltip-->
    </div>

    <div class="block text-left mt-nolus-16">
      <!-- <DynamicForm :formValue="formDataModel" /> -->
      <CurrencyField name="amountSupply" id="amountSupply" label="Amount" />
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      v-on:click="modelValue.onNextClick"
    >
      Supply
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

export interface SupplyComponentProps {
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
  name: "SupplyComponent",
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField,
    TooltipComponent,
  },
  props: {
    modelValue: {
      type: Object as PropType<SupplyComponentProps>,
    },
  },
  data() {
    return {
      // formDataModel: [] as DynamicFormProps[],
    };
  },
  mounted() {
    // this.formDataModel = [
    //   {
    //     formFields: [
    //       {
    //         fieldType: "currencyField",
    //         pickerType: "small",
    //         className: "block currency-field-container",
    //         label: "Amount",
    //         options: [
    //           {
    //             value: "NLS",
    //             label: "NLS",
    //           },
    //           {
    //             value: "ETH",
    //             label: "ETH",
    //           },
    //           {
    //             value: "BTC",
    //             label: "BTC",
    //           },
    //         ],
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
