<template>
  <!-- Input Area -->
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <div class="modal-send-receive-input-area">

      <div class="block py-3 px-4 modal-balance radius-light text-left text-14 nls-font-400 text-primary mb-4">
        {{$t('message.balance') }}:
        <a 
          class="text-secondary nls-font-700 underline ml-2 cursor-pointer" 
          @click.stop="setAmount">
          {{ formatCurrentBalance(modelValue.selectedDownPaymentCurrency) }}
        </a>
      </div>

      <div class="block text-left">
        <div class="block">
          <CurrencyField
            id="amount-investment"
            :currency-options="balances"
            :error-msg="modelValue.downPaymentErrorMsg"
            :is-error="modelValue.downPaymentErrorMsg !== ''"
            :option="modelValue.selectedDownPaymentCurrency"
            :value="modelValue.downPayment"
            :label="$t('message.down-payment-uppercase')"
            name="amountInvestment"
            :tooltip="$t('message.down-payment-tooltip')"
            @input="handleDownPaymentChange($event)"
            @update-currency="(event) => (modelValue.selectedDownPaymentCurrency = event)"
          />
        </div>

        <div class="block mt-[25px]">
          <!-- <CurrencyField
            id="amount-interest"
            :currency-options="modelValue.currentBalance"
            :disabled-input-field="disabledInputField"
            :error-msg="modelValue.amountErrorMsg"
            :is-error="modelValue.amountErrorMsg !== ''"
            :option="modelValue.selectedCurrency"
            :value="modelValue.amount"
            :label="$t('message.asset-to-lease')"
            name="amountInterest"
            @input="handleAmountChange($event)"
            @update-currency="(event) => (modelValue.selectedCurrency = event)"
          /> -->
          <Picker
            class="scrollbar"
            :default-option="coinList[0]"
            :options="coinList"
            :label="$t('message.asset-to-lease')"
            @update-selected="(event) => (modelValue.selectedCurrency = event)"
          />
        </div>
      </div>

      <RangeComponent class="my-8"></RangeComponent>

      <!-- <div class="flex justify-end mt-5 mr-5">
        <p
          v-if="modelValue.selectedCurrency?.balance?.denom"
          class="mb-3 mt-[25px] flex justify-end align-center dark-text nls-font-500 text-14"
        >
          {{
            $t("message.price-in-usd", {
              symbol: formatAssetInfo(
                modelValue.selectedCurrency?.balance?.denom
              ),
            })
          }}
          <span class="inline-block nls-font-700 ml-5">{{
            pricePerToken
          }}</span>
        </p>
      </div> -->
      <div class="flex justify-end">
        <div class="grow-3 text-right nls-font-500 text-14 dark-text">
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.borrowed") }}
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.interest") }}
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.liquidation-price") }}
          </p>
          <p class="mb-2 mt-[14px] mr-5">
            {{ $t("message.gas-service-fees") }}
          </p>
        </div>
        <div class="text-right nls-font-700 text-14">
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            ${{ calculateLeaseAmount }}
            <TooltipComponent :content="$t('message.borrowed-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            {{ annualInterestRate ?? 0 }}%
            <TooltipComponent :content="$t('message.interest-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            $0
            <TooltipComponent :content="$t('message.liquidation-price-tooltip')" />
          </p>
          <p class="mb-2 mt-[14px] flex justify-end align-center dark-text">
            0 NLS
            <TooltipComponent :content="$t('message.liquidation-price-tooltip')" />
          </p>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary">
        {{ $t("message.lease") }}
      </button>
      <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>-{{ NATIVE_NETWORK.longOperationsEstimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import CurrencyField from "@/components/CurrencyField.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";
import Picker from "../Picker.vue";

import type { LeaseComponentProps } from "@/types/component/LeaseComponentProps";
import type { AssetBalance } from "@/stores/wallet/state";

import { ref, watch, type PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Coin } from "@keplr-wallet/unit";
import { useOracleStore } from "@/stores/oracle";
import { computed } from "vue";
import { useWalletStore } from "@/stores/wallet";
import { NATIVE_NETWORK } from "@/config/env";
import RangeComponent from "../RangeComponent.vue";

const oracle = useOracleStore();
const wallet = useWalletStore();

const disabledInputField = ref(true);

const handleDownPaymentChange = (value: string) => {
  props.modelValue.downPayment = value;
};

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const balances = computed(() => {
  return wallet.balances;
  // TODO: uncomemnt for production
  // const balances = wallet.balances;
  // return balances.filter((item) => {
  //   const currency = wallet.currencies[item.balance.denom];
  //   return currency.groups.includes(GROUPS.Lease);
  // });
});

const props = defineProps({
  modelValue: {
    type: Object as PropType<LeaseComponentProps>,
    required: true,
  },
});

const coinList =  props.modelValue.currentBalance.map((item) => {
    const asset = wallet.getCurrencyInfo(item.balance.denom);
    return {
      label: asset.coinAbbreviation,
      value: asset.coinMinimalDenom,
      icon: asset.coinIcon
    }
});


const getPrice = (currencyDenom: string) => {
  const prices = oracle.prices;
  const denom = wallet.currencies[currencyDenom].symbol;
  if (prices) {
    return prices[denom];
  }
  return {
    amount: "0",
    symbol: "",
  };
};

const formatAssetInfo = (currencyDenom: string) => {
  return wallet.currencies[currencyDenom].ticker;
};

const annualInterestRate = computed(() => {
  return props.modelValue?.leaseApply?.annual_interest_rate;
});

const pricePerToken = computed(() => {
  if (props.modelValue?.selectedCurrency?.balance.denom) {
    return getPrice(props.modelValue?.selectedCurrency?.balance.denom)?.amount;
  }
  return "0";
});

const calculateLeaseAmount = computed(() => {
  if (props.modelValue?.amount) {
    const leaseCurrency = props.modelValue?.selectedCurrency;

    if (leaseCurrency) {
      return CurrencyUtils.calculateBalance(
        getPrice(leaseCurrency.balance.denom).amount,
        new Coin(
          leaseCurrency.balance.denom,
          props.modelValue?.amount as string
        ),
        0
      );
    }
  }

  return "0";
});

watch(
  () => props.modelValue.leaseApply,
  () => {
    disabledInputField.value = !props.modelValue?.leaseApply;
  }
);

const setAmount = () => {
  const asset = wallet.getCurrencyInfo(
    props.modelValue.selectedDownPaymentCurrency.balance.denom
  );
  const data = CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.selectedDownPaymentCurrency.balance.amount.toString(),
    props.modelValue.selectedDownPaymentCurrency.balance.denom,
    asset.coinDenom,
    asset.coinDecimals
  );
  props.modelValue.downPayment = Number(data.toDec().toString()).toString();

};

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(
      props.modelValue.selectedDownPaymentCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
};

</script>