<template>
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <!-- Input Area -->
    <div class="modal-send-receive-input-area background">

      <div class="block text-left">
        <div class="block mt-[20px]">
          <CurrencyField
            id="amount"
            :currency-options="modelValue.currentBalance"
            :disabled-currency-picker="false"
            :error-msg="modelValue.amountErrorMsg"
            :is-error="modelValue.amountErrorMsg !== ''"
            :option="modelValue.selectedCurrency"
            :value="modelValue.amount"
            :name="$t('message.amount')"
            :label="$t('message.amount-field')"
            :set-input-value="setAmount"
            @input="handleAmountChange($event)"
            @update-currency="(event) => (modelValue.selectedCurrency = event)"
            :balance="formatCurrentBalance(modelValue.selectedCurrency)"
          />
        </div>

        <div class="block mt-[20px]">
          <Picker
            :default-option="networks[0]"
            :options="networks"
            :label="$t('message.network')"
            :value="modelValue.network"
            @update-selected="onUpdateCurrency"
          />
        </div>

        <div v-if="modelValue.network.native" class="block mt-[20px]">
          <InputField
            :error-msg="modelValue.receiverErrorMsg"
            :is-error="modelValue.receiverErrorMsg !== ''"
            :value="modelValue.receiverAddress"
            :label="$t('message.recipient')"
            id="sendTo"
            name="sendTo"
            type="text"
            @input="
              (event) => (modelValue.receiverAddress = event.target.value)
            "
          />
        </div>

        <div v-else>
          <p class="text-14 nls-font-500 text-primary m-0 mb-[6px] mt-4">
            {{ $t("message.recipient") }}
          </p>
          <p class="text-14 text-primary nls-font-700 m-0 break-all">
            {{ address }}
          </p>
        </div>

        <!-- <div class="block mt-[20px]">
          <InputField 
            id="memo" 
            name="memo" 
            type="text"
            :value="modelValue.memo" 
            :label="$t('message.memo-only')" 
            @input="(event) => (modelValue.memo = event.target.value)">
          </InputField>
        </div> -->
      </div>
    </div>
    <!-- Actions -->
    <div class="modal-send-receive-actions background flex-col">
      <button class="btn btn-primary btn-large-primary">
        {{ $t("message.send") }}
      </button>
      <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>~{{ modelValue.network.estimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { SendComponentProps } from "@/types/component/SendComponentProps";
import type { AssetBalance } from "@/stores/wallet/state";
import type { Network } from "@/types";

import Picker from "@/components/Picker.vue";
import InputField from "@/components/InputField.vue";
import CurrencyField from "@/components/CurrencyField.vue";

import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/stores/wallet";
import { WalletUtils } from "@/utils";
import { computed } from "vue";
import { SUPPORTED_NETWORKS } from "@/networks/config";
import { Dec } from "@keplr-wallet/unit";

const props = defineProps({
  modelValue: {
    type: Object as PropType<SendComponentProps>,
    default: {} as object,
  },
});

const networks = SUPPORTED_NETWORKS;
const wallet = useWalletStore();

defineEmits(["update:modelValue.selectedCurrency"]);

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(
      props.modelValue.selectedCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.coinDenom,
      asset.coinDecimals
    ).toString();
  }
};

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const address = computed(() => {
  return WalletUtils.transformWallet(props.modelValue.network.prefix);
});

const onUpdateCurrency = (event: Network) => {
  props.modelValue.network = event;
  if (!event.native) {
    props.modelValue.receiverAddress = address.value;
  } else {
    props.modelValue.receiverAddress = "";
  }
};

const setAmount = (p: number) => {
  const asset = wallet.getCurrencyInfo(
    props.modelValue.selectedCurrency.balance.denom
  );
  const percent = new Dec(p).quo(new Dec(100));
  const amount = CurrencyUtils.convertMinimalDenomToDenom(props.modelValue.selectedCurrency.balance.amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals).toDec();
  const value = amount.mul(percent);
  props.modelValue.amount = value.toString(asset.coinDecimals);
};
</script>
