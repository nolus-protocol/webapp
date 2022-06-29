<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div
      class="block mb-nolus-13 bg-light-grey nls-balance radius-light text-left text-primary"
    >
      <span class="nls-14 nls-font-500"> Current balance:</span>

      <a href="#" class="nls-14 nls-font-700 underline ml-2">
        {{ formatCurrentBalance(modelValue.currentBalance) || " 125 NLS" }}
      </a>
    </div>

    <div class="block text-left">
      <CurrencyField name="amountSupply" id="amountSupply" label="Amount" />
      <div
        class="flex items-center box box-warning radius-rounded p-4 m-nolus-24 mt-nolus-24 text-left break-words"
      >
        <div class="inline-block mr-2 pr-nolus-15">
          <!-- TODO: change when have corrent icon -->
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M6 -0.000976562C5.60218 -0.000976562 5.22064 0.157059 4.93934 0.438363C4.65804 0.719668 4.5 1.1012 4.5 1.49902V2.99902H3C2.20435 2.99902 1.44129 3.31509 0.87868 3.8777C0.316071 4.44031 0 5.20337 0 5.99902V20.999C0 21.7947 0.316071 22.5577 0.87868 23.1203C1.44129 23.683 2.20435 23.999 3 23.999H21C21.7956 23.999 22.5587 23.683 23.1213 23.1203C23.6839 22.5577 24 21.7947 24 20.999V5.99902C24 5.20337 23.6839 4.44031 23.1213 3.8777C22.5587 3.31509 21.7956 2.99902 21 2.99902H19.5V1.49902C19.5 1.1012 19.342 0.719668 19.0607 0.438363C18.7794 0.157059 18.3978 -0.000976562 18 -0.000976562C17.6022 -0.000976562 17.2206 0.157059 16.9393 0.438363C16.658 0.719668 16.5 1.1012 16.5 1.49902V2.99902H7.5V1.49902C7.5 1.1012 7.34196 0.719668 7.06066 0.438363C6.77936 0.157059 6.39782 -0.000976562 6 -0.000976562ZM6 7.49902C5.60218 7.49902 5.22064 7.65706 4.93934 7.93836C4.65804 8.21967 4.5 8.6012 4.5 8.99902C4.5 9.39685 4.65804 9.77838 4.93934 10.0597C5.22064 10.341 5.60218 10.499 6 10.499H18C18.3978 10.499 18.7794 10.341 19.0607 10.0597C19.342 9.77838 19.5 9.39685 19.5 8.99902C19.5 8.6012 19.342 8.21967 19.0607 7.93836C18.7794 7.65706 18.3978 7.49902 18 7.49902H6Z"
              fill="#FFB922"
            />
          </svg>
        </div>
        <div class="block box box-warning grow-1">
          <p class="text-left text-primary nls-14 nls-font-400">
            <span class="nls-font-500 nls-14">21 Days Unbounding Period</span>
            <br />
            <span class="nls-font-400 nls-14"> Dec 29, 2021 @ 18:00 UTC</span>
          </p>
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
      Withdraw
    </button>
  </div>
</template>

<script lang="ts">
import { StarIcon } from "@heroicons/vue/solid";
import CurrencyField from "@/components/CurrencyField.vue";
import { defineComponent, PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetBalance } from "@/store/modules/wallet/state";
import { SupplyComponentProps } from "./SupplyComponent.vue";

export default defineComponent({
  name: "SwapComponent",
  components: {
    StarIcon,
    CurrencyField,
  },
  props: {
    modelValue: {
      type: Object as PropType<SupplyComponentProps>,
    },
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
