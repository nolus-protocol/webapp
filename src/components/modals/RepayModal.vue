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
        <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg" />
      </button>
      <div class="flex modal-header">
        <p class="nls-32 nls-font-700">Repay</p>
      </div>

      <div class="block text-left px-10 mt-nolus-41">
        <!-- <div
          class="block mb-nolus-13 py-3 px-4 bg-light-grey radius-light text-left nls-14 nls-font-400 text-primary nls-font-400"
        >
          Current balance:
          <a href="#" class="text-secondary nls-font-700 nls-14 underline ml-2">
            $36,423.02
          </a>
        </div> -->
        <div
          class="block nls-balance mb-nolus-13 bg-light-grey radius-light text-left text-primary"
        >
          Current balance:

          <a class="text-secondary nls-font-700 underline ml-2" href="#">
            $36,423.02
          </a>
        </div>
        <!-- <DynamicForm :formValue="formDataModel" /> -->
        <!-- {
            fieldType: "currencyField",
            className: "block currency-field-container",
            label: "Balance To Repay",
            options: [
              {
                value: "NLS",
                label: "NLS",
              },
              {
                value: "ETH",
                label: "ETH",
              },
              {
                value: "BTC",
                label: "BTC",
              },
            ],
          }, -->

        <CurrencyField
          id="repayBalance"
          label="Balance To Repay"
          name="repayBalance"
          value=""
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
              <TooltipComponent content="Content goes here" />
            </p>
            <p class="mb-nolus-12 flex justify-end align-center">
              $35,311.00
              <TooltipComponent content="Content goes here" />
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
import { StarIcon } from "@heroicons/vue/solid";
import CurrencyField from "@/components/CurrencyField.vue";
import PickerDefault from "@/components/PickerDefault.vue";
import InputField from "@/components/InputField.vue";
import { defineComponent } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetBalance } from "@/store/modules/wallet/state";
// import DynamicForm, {
//   DynamicFormProps,
// } from "@/components/templates/dynamic-form-template/DynamicForm.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";

export default defineComponent({
  name: "LeaseModal",
  components: {
    StarIcon,
    CurrencyField,
    PickerDefault,
    InputField,
    TooltipComponent,
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
<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
</style>
