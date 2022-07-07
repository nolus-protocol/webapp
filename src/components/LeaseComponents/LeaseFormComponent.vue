<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <CurrencyField
          id="amount-investment"
          :currency-options="modelValue.currentBalance"
          :error-msg="modelValue.downPaymentErrorMsg"
          :is-error="modelValue.downPaymentErrorMsg !== ''"
          :option="modelValue.selectedDownPaymentCurrency"
          :step="'1'"
          :value="modelValue.downPayment"
          label="How much do you want to invest?"
          name="amountInvestment"
          @input="(event) => (modelValue.downPayment = event.target.value)"
          @update-currency="
            (event) => (modelValue.selectedDownPaymentCurrency = event)
          "
        />
      </div>

      <div class="block mt-nolus-255">
        <CurrencyField
          id="amount-interest"
          :currency-options="modelValue.currentBalance"
          :disabled-currency-picker="true"
          :disabled-input-field="disabledInputField"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          label="Get up to:"
          name="amountInterest"
          @input="(event) => (modelValue.amount = event.target.value)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
      </div>
    </div>

    <div class="flex justify-end mt-5">
      <p
        v-if="modelValue.selectedCurrency.udenom"
        class="inline-block m-0 text-left text-primary nls-14 nls-font-400"
      >
        1 {{ formatAssetInfo(modelValue.selectedCurrency.udenom) }} price in
        USD:
        <span class="inline-block nls-font-700 ml-5">{{ pricePerToken }}</span>
      </p>
    </div>
    <div class="text-right nls-font-700 nls-14">
      <p class="mb-nolus-12 mt-nolus-255 flex justify-end align-center">
        Leased amount:
        <span class="flex nls-font-700 ml-5">
          {{ calculateLeaseAmount }}
          <TooltipComponent content="Content goes here" />
        </span>
      </p>
    </div>
    <div class="text-right nls-font-700 nls-14">
      <p
        v-if="this.annualInterestRate"
        class="mb-nolus-12 mt-nolus-255 flex justify-end align-center"
      >
        Annual interest:
        <span class="flex nls-font-700 ml-5">
          {{ this.annualInterestRate }}
          <TooltipComponent content="Content goes here" />
        </span>
      </p>
    </div>
    <div class="text-right nls-font-700 nls-14">
      <p class="mb-nolus-12 mt-nolus-255 flex justify-end align-center">
        Liquidation price:
        <span class="flex nls-font-700 ml-5">
          $18,585.00
          <TooltipComponent content="Content goes here" />
        </span>
      </p>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary"
      v-on:click="modelValue.onNextClick"
    >
      Lease
    </button>
  </div>
</template>

<script lang="ts">
import CurrencyField from "@/components/CurrencyField.vue";
import { defineComponent, PropType } from "vue";
import { AssetBalance } from "@/store/modules/wallet/state";
import { LeaseApply } from "@nolus/nolusjs/build/contracts";
import { useStore } from "@/store";
import { StringUtils } from "@/utils/StringUtils";
import { Price } from "@/store/modules/oracle/state";
import { assetInfo } from "@/config/assetInfo";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Coin } from "@keplr-wallet/unit";
import TooltipComponent from "@/components/TooltipComponent.vue";

export interface LeaseComponentProps {
  contractAddress: string;
  amountErrorMsg: string;
  downPaymentErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedDownPaymentCurrency: AssetBalance;
  selectedCurrency: AssetBalance;
  downPayment: string;
  amount: string;
  memo: string;
  password: string;
  passwordErrorMsg: string;
  txHash: string;
  leaseApply: LeaseApply | null;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

export default defineComponent({
  name: "LeaseFormComponent",
  components: {
    CurrencyField,
    TooltipComponent,
  },
  props: {
    modelValue: {
      type: Object as PropType<LeaseComponentProps>,
    },
  },
  data() {
    return {
      disabledInputField: true,
    };
  },
  mounted() {
    console.log(this.modelValue);
  },
  watch: {
    "modelValue.leaseApply"() {
      this.disabledInputField = !this.modelValue?.leaseApply;
    },
  },
  computed: {
    annualInterestRate() {
      return this.modelValue?.leaseApply?.annual_interest_rate || "";
    },
    pricePerToken() {
      if (this.modelValue?.selectedCurrency?.udenom) {
        return this.getPrice(this.modelValue?.selectedCurrency?.udenom).amount;
      }
      return "0";
    },
    calculateLeaseAmount() {
      if (this.modelValue?.amount) {
        const leaseCurrency = this.modelValue?.selectedCurrency;
        if (leaseCurrency) {
          return CurrencyUtils.calculateBalance(
            this.getPrice(leaseCurrency.balance.denom).amount,
            new Coin(
              leaseCurrency.balance.denom,
              this.modelValue?.amount as string
            ),
            0
          );
        }
      }

      return "0";
    },
  },
  methods: {
    getPrice(minimalDenom: string): Price {
      const prices = useStore().getters.getPrices;
      const denom = StringUtils.getDenomFromMinimalDenom(minimalDenom);
      if (prices) {
        return prices[denom];
      }
      return {
        amount: "0",
        denom: "",
      };
    },
    formatAssetInfo(minimalDenom: string) {
      if (minimalDenom) {
        return assetInfo[minimalDenom].coinAbbreviation;
      }
      return "";
    },
  },
});
</script>
