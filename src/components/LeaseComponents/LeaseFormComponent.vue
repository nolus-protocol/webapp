<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <CurrencyField
          id="amount-investment"
          :currency-options="balances"
          :error-msg="modelValue.downPaymentErrorMsg"
          :is-error="modelValue.downPaymentErrorMsg !== ''"
          :option="modelValue.selectedDownPaymentCurrency"
          :step="'1'"
          :value="modelValue.downPayment"
          :label="$t('message.invest-question')"
          name="amountInvestment"
          @input="handleDownPaymentChange($event)"
          @update-currency="(event) => (modelValue.selectedDownPaymentCurrency = event)"
        />
      </div>

      <div class="block mt-[25px]">
        <CurrencyField
          id="amount-interest"
          :currency-options="modelValue.currentBalance"
          :disabled-currency-picker="true"
          :disabled-input-field="disabledInputField"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          :label="$t('message.get-up-to')"
          name="amountInterest"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
      </div>
    </div>

    <div class="flex justify-end mt-5 mr-5">
      <p
        v-if="modelValue.selectedCurrency?.balance?.denom"
        class="mb-3 mt-[25px] flex justify-end align-center dark-text nls-font-500 text-14"
      >
        1 {{ formatAssetInfo(modelValue.selectedCurrency?.balance?.denom) }} price in USD:
        <span class="inline-block nls-font-700 ml-5">{{ pricePerToken }}</span>
      </p>
    </div>
    <div class="flex justify-end">
      <div class="grow-3 text-right nls-font-500 text-14 dark-text">
        <p class="mb-3 mt-[25px] mr-5">
          {{ $t("message.leased-amount") }}
        </p>
        <p v-if="annualInterestRate" class="mb-3 mr-5">
          {{ $t("message.annual-interest") }}
        </p>
        <p class="mb-3 mt-[25px] mr-5">
          {{ $t("message.liquidation-price") }}
        </p>
      </div>
      <div class="text-right nls-font-700 text-14">
        <p class="mb-3 mt-[25px] flex justify-end align-center dark-text">
          {{ calculateLeaseAmount }}
          <TooltipComponent content="Content goes here" />
        </p>
        <p v-if="annualInterestRate" class="mb-3 flex justify-end align-center">
          <span class="flex nls-font-700 ml-5">
            {{ annualInterestRate }}
            <TooltipComponent content="Content goes here" />
          </span>
        </p>
        <p class="mb-3 mt-[25px] flex justify-end align-center dark-text">
          $18,585.00
          <TooltipComponent content="Content goes here" />
        </p>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary"
      @click="modelValue.onNextClick"
    >
      {{ $t("message.lease") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import CurrencyField from '@/components/CurrencyField.vue';
import TooltipComponent from '@/components/TooltipComponent.vue';

import type { LeaseComponentProps } from '@/types/component/LeaseComponentProps';

import { ref, watch, type PropType } from 'vue';
import { StringUtils } from '@/utils/StringUtils';
import { assetsInfo } from '@/config/assetsInfo';
import { CurrencyUtils } from '@nolus/nolusjs';
import { Coin } from '@keplr-wallet/unit';
import { useOracleStore } from '@/stores/oracle';
import { computed } from 'vue';
import { LPP_CONSTANTS } from '@/config/contracts';
import { EnvNetworkUtils } from '@/utils';

const oracle = useOracleStore();
const disabledInputField = ref(true);

const handleDownPaymentChange = (event: Event) => {
  props.modelValue.downPayment = (event.target as HTMLInputElement).value;
};

const handleAmountChange = (event: Event) => {
  props.modelValue.amount = (event.target as HTMLInputElement).value;
};

const balances = computed(() => {
  const balances = props.modelValue.currentBalance;
  const lpp_coins = LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()];
  return balances.filter((item) => lpp_coins[item.balance.denom] );
});

const props = defineProps({
  modelValue: {
    type: Object as PropType<LeaseComponentProps>,
    required: true,
  },
});

const getPrice = (currencyDenom: string) => {
  const prices = oracle.prices;
  const denom = StringUtils.getDenomFromMinimalDenom(currencyDenom);
  if (prices) {
    return prices[denom];
  }
  return {
    amount: '0',
    symbol: '',
  };
};

const formatAssetInfo = (currencyDenom: string) => {
  if (currencyDenom) {
    return assetsInfo[currencyDenom].coinAbbreviation;
  }
  return '';
};

const annualInterestRate = computed(() => {
  return props.modelValue?.leaseApply?.annual_interest_rate || '';
});

const pricePerToken = computed(() => {
  if (props.modelValue?.selectedCurrency?.balance.denom) {
    return getPrice(props.modelValue?.selectedCurrency?.balance.denom).amount;
  }
  return '0';
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

  return '0';
});

watch(
  () => props.modelValue.leaseApply,
  () => {
    disabledInputField.value = !props.modelValue?.leaseApply;
  }
);
</script>
