<template>
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <!-- Input Area -->
    <div class="modal-send-receive-input-area background">
      <div class="block py-3 px-4 modal-balance radius-light text-left text-14 nls-font-400 text-primary">
        {{$t('message.balance') }}:
        <a class="text-secondary nls-font-700 underline ml-2 cursor-pointer" @click.stop="setAmount">
          {{ formatCurrentBalance(modelValue.selectedCurrency) }}
        </a>
      </div>
  
      <div class="block text-left">
        <div class="block mt-[25px]">
          <CurrencyField 
            id="amount" 
            :currency-options="modelValue.currentBalance" 
            :disabled-currency-picker="false"
            :error-msg="modelValue.amountErrorMsg" 
            :is-error="modelValue.amountErrorMsg !== ''"
            :option="modelValue.selectedCurrency" 
            :value="modelValue.amount" 
            :name="$t('message.amount')"
            :label="$t('message.amount-repay')" 
            @input="handleAmountChange($event)"
            @update-currency="(event) => (modelValue.selectedCurrency = event)" />
        </div>
  
        <div class="block mt-[25px]">
          <InputField 
            :error-msg="modelValue.receiverErrorMsg" 
            :is-error="modelValue.receiverErrorMsg !== ''"
            :value="modelValue.receiverAddress" 
            :label="$t('message.recipient')" 
            id="sendTo" 
            name="sendTo" 
            type="text"
            @input="(event) => (modelValue.receiverAddress = event.target.value)" />
        </div>
  
        <div class="block mt-[25px]">
          <Picker 
          :default-option="networks[0]" 
          :disabled="true" 
          :options="networks" 
          :label="$t('message.network')" />
        </div>
  
        <div class="block mt-[25px]">
          <InputField id="memo" :value="modelValue.memo" :label="$t('message.memo-only')" name="memo" type="text"
            @input="(event) => (modelValue.memo = event.target.value)"></InputField>
        </div>
      </div>
    </div>
    <!-- Actions -->
    <div class="modal-send-receive-actions background">
      <button class="btn btn-primary btn-large-primary">
        {{ $t('message.next') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { SendComponentProps } from '@/types/component/SendComponentProps';
import type { AssetBalance } from '@/stores/wallet/state';

import Picker from '@/components/Picker.vue';
import InputField from '@/components/InputField.vue';
import CurrencyField from '@/components/CurrencyField.vue';

import { CurrencyUtils } from '@nolus/nolusjs';
import { DEFAULT_NETWORK } from '@/config/env';
import { useWalletStore } from '@/stores/wallet';

const props = defineProps({
  modelValue: {
    type: Object as PropType<SendComponentProps>,
    default: {} as object,
  }
});

const networks = [DEFAULT_NETWORK];
const wallet = useWalletStore();

defineEmits(['update:modelValue.selectedCurrency']);

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
};

const handleAmountChange = (event: Event) => {
  props.modelValue.amount = (event.target as HTMLInputElement).value;
};

const setAmount = () => {
  const asset = wallet.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
  const data = CurrencyUtils.convertMinimalDenomToDenom(
    props.modelValue.selectedCurrency.balance.amount.toString(),
    props.modelValue.selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    )

  props.modelValue.amount = data.hideDenom(true).locale(false).toString();
}

</script>
