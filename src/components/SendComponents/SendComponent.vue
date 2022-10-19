<template>
  <!-- Input Area -->
  <div class="modal-send-receive-input-area">
    <div class="block py-3 px-4 modal-balance radius-light text-left text-14 nls-font-400 text-primary">
      {{$t('message.balance') }}:
      <a class="text-secondary nls-font-700 underline ml-2" href="#">
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
          label="Amount" 
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)" />
      </div>

      <div class="block mt-[25px]">
        <Picker 
        :default-option="networks[0]" 
        :disabled="true" 
        :options="networks" 
        label="Network" />
      </div>

      <div class="block mt-[25px]">
        <InputField 
          :error-msg="modelValue.receiverErrorMsg" 
          :is-error="modelValue.receiverErrorMsg !== ''"
          :value="modelValue.receiverAddress" 
          :label="$t('message.send-to')" 
          id="sendTo" 
          name="sendTo" 
          type="text"
          @input="(event) => (modelValue.receiverAddress = event.target.value)" />
      </div>

      <div class="block mt-[25px]">
        <InputField id="memo" :value="modelValue.memo" label="Memo (optional)" name="memo" type="text"
          @input="(event) => (modelValue.memo = event.target.value)"></InputField>

        <div class="block mt-2">
          <button class="btn btn-secondary btn-medium-secondary btn-icon ml-auto mr-0 flex items-center">
            <StarIcon class="inline-block icon w-4 h-4 mr-1" />
            {{ $t('message.save-contact') }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <!-- Actions -->
  <div class="modal-send-receive-actions">
    <button class="btn btn-primary btn-large-primary" @click="modelValue.onNextClick">
      {{ $t('message.next') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { SendComponentProps } from '@/types/component/SendComponentProps';
import type { AssetBalance } from '@/stores/wallet/state';

import Picker from '@/components/Picker.vue';
import InputField from '@/components/InputField.vue';
import CurrencyField from '@/components/CurrencyField.vue';

import { assetsInfo } from '@/config/assetsInfo';
import { StarIcon } from '@heroicons/vue/24/solid';
import { CurrencyUtils } from '@nolus/nolusjs';

const props = defineProps({
  modelValue: {
    type: Object as PropType<SendComponentProps>,
    default: {} as object,
  }
});

const networks = [
  { value: 'NLS', label: 'NLS' },
];

defineEmits(['update:modelValue.selectedCurrency']);

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = assetsInfo[selectedCurrency.balance.denom];
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

</script>
