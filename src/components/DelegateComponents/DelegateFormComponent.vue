<template>
  <form @submit.prevent="modelValue.onNextClick" class="modal-form">
    <!-- Input Area -->
    <div class="modal-send-receive-input-area">

      <div class="block text-left mt-[25px]">
        <CurrencyField
          id="amountSupply"
          :currency-options="modelValue.currentBalance"
          :error-msg="modelValue.amountErrorMsg"
          :is-error="modelValue.amountErrorMsg !== ''"
          :option="modelValue.selectedCurrency"
          :value="modelValue.amount"
          :label="$t('message.amount')"
          :balance="formatCurrentBalance()"
          :total="props.modelValue.selectedCurrency.balance"
          :set-input-value="setAmount"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
        <WarningBox :isWarning="true" class="mt-[25px]">
          <template v-slot:icon>
            <img
              class="block mx-auto my-0 w-10 h-7"
              src="@/assets/icons/information-circle.svg"
            />
          </template>
          <template v-slot:content>
            <span class="text-primary">
              {{ $t("message.delegate-description") }}
            </span>
          </template>
        </WarningBox>
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions flex flex-col">
      <button class="btn btn-primary btn-large-primary text-center">
        {{ $t("message.delegate") }}
      </button>
      <a
        :href="`${stakingUrl}`"
        class="his-url text-14 flex mt-4 flex self-start"
        target="_blank"
      >
        {{ $t("message.manual-delegation") }}
        <img
          src="@/assets/icons/urlicon.svg"
          class="float-right w-3 his-img ml-2 mb-[2px]"
        />
      </a>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { DelegateFormComponentProps } from "@/types/component";
import type { PropType } from "vue";

import CurrencyField from "@/components/CurrencyField.vue";
import WarningBox from "@/components/modals/templates/WarningBox.vue";
import { useWalletStore } from "@/stores/wallet";
import { CurrencyUtils } from "@nolus/nolusjs";
import { EnvNetworkUtils } from "@/utils";
import { NETWORKS } from "@/config/env";
import { Dec } from "@keplr-wallet/unit";

const stakingUrl = NETWORKS[EnvNetworkUtils.getStoredNetworkName()].staking;

const props = defineProps({
  modelValue: {
    type: Object as PropType<DelegateFormComponentProps>,
    required: true,
  },
});

const walletStore = useWalletStore();

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

function formatCurrentBalance() {
    const asset = walletStore.getCurrencyInfo(props.modelValue.selectedCurrency.balance.denom);
    return CurrencyUtils.convertMinimalDenomToDenom(
      props.modelValue.selectedCurrency.balance.amount.toString(),
      props.modelValue.selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
}

const setAmount = (p: number) => {
  const asset = walletStore.getCurrencyInfo(
    props.modelValue.selectedCurrency.balance.denom
  );
  const percent = new Dec(p).quo(new Dec(100));
  const amount = CurrencyUtils.convertMinimalDenomToDenom(props.modelValue.selectedCurrency.balance.amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals).toDec();
  const value = amount.mul(percent);
  props.modelValue.amount = value.toString(asset.coinDecimals);
};

defineEmits(["update:modelValue.selectedCurrency"]);
</script>