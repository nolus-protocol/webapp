<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <CurrencyField
          name="amountInvestment"
          id="amount-investment"
          label="How much do you want to invest?"
          :value="modelValue.downPayment"
          :step="'1'"
          @input="(event) => (modelValue.downPayment = event.target.value)"
          :currency-options="modelValue.currentBalance"
          :option="modelValue.selectedDownPaymentCurrency"
          @update-currency="
            (event) => (modelValue.selectedDownPaymentCurrency = event)
          "
          :error-msg="modelValue.downPaymentErrorMsg"
          :is-error="modelValue.downPaymentErrorMsg !== ''"
        />
      </div>

      <div class="block mt-nolus-255">
        <CurrencyField
          name="amountInterest"
          id="amount-interest"
          label="Get up to:"
          :value="modelValue.amount"
          @input="(event) => (modelValue.amount = event.target.value)"
          :currency-options="modelValue.currentBalance"
          :option="modelValue.selectedCurrency"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :disabled-currency-picker="true"
          :disabled-input-field="disabledInputField"
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
    <div class="flex justify-end mt-3">
      <p class="inline-block m-0 text-left text-primary nls-14 nls-font-400">
        Leased amount:
        <span class="inline-block nls-font-700 ml-5">
          {{ calculateLeaseAmount }}
          <img
            :src="require('@/assets/icons/tooltip.svg')"
            width="12"
            height="12"
            class="inline-block m-0 ml-1"
          />
        </span>
      </p>
    </div>
    <div class="flex justify-end mt-3">
      <p
        v-if="this.annualInterestRate"
        class="inline-block m-0 text-left text-primary nls-14 nls-font-400"
      >
        Annual interest:
        <span class="inline-block nls-font-700 ml-5">
          {{ this.annualInterestRate }}
          <img
            :src="require('@/assets/icons/tooltip.svg')"
            width="12"
            height="12"
            class="inline-block m-0 ml-1"
          />
        </span>
      </p>
    </div>
    <div class="flex justify-end mt-3">
      <p class="inline-block m-0 text-left text-primary nls-14 nls-font-400">
        Liquidation price:
        <span class="inline-block nls-font-700 ml-5">
          $18,585.00
          <img
            :src="require('@/assets/icons/tooltip.svg')"
            width="12"
            height="12"
            class="inline-block m-0 ml-1"
          />
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
            this.getPrice(leaseCurrency.udenom).amount,
            new Coin(leaseCurrency.udenom, this.modelValue?.amount as string),
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
