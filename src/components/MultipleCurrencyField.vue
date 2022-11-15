<template>
  <div class="block currency-field-container">
    <div
      class="currency-field py-3.5"
      :class="[isError === true ? 'error' : '']"
    >
      <div class="flex items-center px-3.5">
        <div class="inline-block w-1/2">
          <input
            class="nls-font-700 text-18 text-primary"
            type="number"
            :value="amount"
            @input="(event: Event) => $emit('updateAmount', (event.target as HTMLInputElement).value)"
          />
          <span class="block text-14 nls-font-400 text-light-blue">
            {{ swapBalance }}
          </span>
        </div>
        <div class="inline-block w-1/2">
          <CurrencyPicker
            :options="swapFromOptions"
            :currencyOption="selectedOption"
            :disabled="false"
            :label="$t('message.asset')"
            @update-currency="(value: any) => $emit('updateCurrency', value)"
          />
        </div>
      </div>
      <div class="separator">
        <div class="arrow-box">
          <ArrowDownIcon />
        </div>
      </div>
      <div class="flex items-center px-3.5">
        <div class="inline-block w-1/2">
          <input
            class="nls-font-700 text-18 text-primary"
            type="number"
            disabled="true"
            :value="swapAmount"
          />
          <span class="block text-14 nls-font-400 text-light-blue">
            {{ swapBalance }}
          </span>
        </div>
        <div class="inline-block w-1/2">
          <CurrencyPicker
            :options="currencyOptions"
            :currencyOption="swapToOption"
            :disabled="false"
            :label="$t('message.asset')"
            @update-currency="(value: any) => $emit('updateSwapToCurrency', value)"
          />
        </div>
      </div>
    </div>

    <span
      class="msg error"
      :class="[
        errorMsg?.length > 0 ? '' : 'hidden',
      ]"
      >
      {{ errorMsg?.length > 0 ? errorMsg : "" }}
    </span>
  </div>
</template>

<script lang="ts" setup>
import type { AssetBalance } from '@/stores/wallet/state';
import CurrencyPicker from '@/components/CurrencyPicker.vue';

import { computed } from 'vue';
import { ArrowDownIcon } from '@heroicons/vue/24/solid';
import { CurrencyUtils } from '@nolus/nolusjs';
import { Coin, Int } from '@keplr-wallet/unit';
import { useOracleStore } from '@/stores/oracle';
import { useWalletStore } from '@/stores/wallet';

const oracle = useOracleStore();
const wallet = useWalletStore();

interface Props {
  amount: string;
  currencyOptions: AssetBalance[];
  selectedOption: AssetBalance;
  swapToOption: AssetBalance;
  isError: boolean;
  errorMsg: string;
}

const props = defineProps<Props>();
defineEmits(['updateCurrency', 'updateAmount', 'updateSwapToCurrency']);

const swapBalance = computed(() =>
  calculateInputBalance(props.amount, props.selectedOption.balance.denom)
);

const swapFromOptions = computed(() => {
  return props.currencyOptions.filter((asset) =>
    asset.balance.amount.gt(new Int('0'))
  );
});

const swapAmount = computed(() => {
  if (swapBalance.value !== '$0') {
    return calculateSwapAmount(Number(swapBalance.value.toDec().toString(1)));
  }
});

// @TODO: Extract function to utils - used also in CurrencyField.
function calculateInputBalance(amount: string, denom: string) {
  const prices = oracle.prices;

  if (!amount || !denom || !prices) {
    return '$0';
  }

  const { coinDecimals, coinMinimalDenom } = wallet.getCurrencyInfo(denom);
  const asset = CurrencyUtils.convertDenomToMinimalDenom(
    props.amount,
    coinMinimalDenom,
    coinDecimals
  );
  const coin = new Coin(denom, new Int(String(asset.amount)));
  const tokenPrice = prices[denom]?.amount || '0';

  return CurrencyUtils.calculateBalance(tokenPrice, coin, coinDecimals);
}

function calculateSwapAmount(balance: number) {
  const prices = oracle.prices;

  if (!prices) {
    return '0';
  }

  const swapToDenom = props.swapToOption.balance.denom;
  const tokenPrice = prices[swapToDenom]?.amount || '0';

  // @TODO implement coin conversion
  console.log('converted info > ', tokenPrice, swapToDenom);
  const mockedCoinResult = new Coin(
    swapToDenom,
    new Int((balance / Number(tokenPrice)).toFixed())
  );

  return mockedCoinResult.amount;
}
</script>
