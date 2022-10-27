<template>
  <div class="modal-send-receive-input-area">
    <div
      class="flex py-3 px-4 bg-light-grey radius-light text-left text-14 nls-font-400 text-primary"
    >
      <span class="text-14 nls-font-500"> {{ $t('message.available-withdraw') }}:</span>
      <a class="text-secondary text-14 nls-font-700 underline ml-2 cursor-pointer" @click.stop="setAmount()">
        {{ formatCurrentBalance(modelValue.currentDepositBalance) }}
      </a>
    </div>
    <div class="block text-left mt-[25px]">
      <CurrencyField
        id="amountSupply"
        :currency-options="modelValue.currentBalance"
        :disabled-currency-picker="false"
        :error-msg="modelValue.amountErrorMsg"
        :is-error="modelValue.amountErrorMsg !== ''"
        :option="modelValue.selectedCurrency"
        :value="modelValue.amount"
        :label="$t('message.amount')"
        name="amountSupply"
        @input="handleAmountChange($event)"
        @update-currency="(event) => (modelValue.selectedCurrency = event)"
      />
    </div>
  </div>

  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button
      class="btn btn-primary btn-large-primary text-center"
      @click="modelValue.onNextClick"
    >
      {{ $t('message.withdraw') }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import CurrencyField from '@/components/CurrencyField.vue';

import type { AssetBalance } from '@/stores/wallet/state';
import type { WithdrawFormComponentProps } from '@/types/component/WithdrawFormComponentProps';
import type { PropType } from 'vue';
import { CurrencyUtils } from '@nolus/nolusjs';
import { useWalletStore } from '@/stores/wallet';

const props = defineProps({
  modelValue: {
    type: Object as PropType<WithdrawFormComponentProps>,
    required: true,
  },
});

const walletStore = useWalletStore();

defineEmits(['update:modelValue.selectedCurrency']);

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = walletStore.getCurrencyInfo(selectedCurrency?.balance?.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
}

const handleAmountChange = (event: Event) => {
  props.modelValue.amount = (event.target as HTMLInputElement).value;
};

const setAmount = () => {
  const asset = walletStore.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  const data = CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.currentDepositBalance.balance.amount.toString(),
    props.modelValue.currentDepositBalance.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    )
  props.modelValue.amount = data.hideDenom(true).locale(false).toString();
}
</script>
