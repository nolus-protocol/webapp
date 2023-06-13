<template>
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <div class="modal-send-receive-input-area">

      <div class="block text-left mt-[25px]">
        <CurrencyField
          id="amountSupply"
          :currency-options="modelValue.currentBalance"
          :disabled-currency-picker="true"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          :label="$t('message.amount')"
          :balance="formatCurrentBalance(modelValue.currentDepositBalance)"
          :set-input-value="setAmount"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button class="btn btn-primary btn-large-primary text-center plausible-event-name=withdraw">
        {{ $t("message.withdraw") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CurrencyField from "@/components/CurrencyField.vue";

import type { AssetBalance } from "@/stores/wallet/state";
import type { WithdrawFormComponentProps } from "@/types/component/WithdrawFormComponentProps";
import type { PropType } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";

const props = defineProps({
  modelValue: {
    type: Object as PropType<WithdrawFormComponentProps>,
    required: true,
  },
});

const walletStore = useWalletStore();

defineEmits(["update:modelValue.selectedCurrency"]);

function formatCurrentBalance(selectedCurrency: AssetBalance) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = walletStore.getCurrencyInfo(selectedCurrency?.balance?.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
  }
}

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const setAmount = (p: number) => {
  const asset = walletStore.getCurrencyInfo(
    props.modelValue.selectedCurrency.balance.denom
  );
  const percent = new Dec(p).quo(new Dec(100));
  const amount = CurrencyUtils.convertMinimalDenomToDenom(props.modelValue.currentDepositBalance.balance.amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals).toDec();
  const value = amount.mul(percent);
  props.modelValue.amount = value.toString(asset.coinDecimals);
};
</script>
