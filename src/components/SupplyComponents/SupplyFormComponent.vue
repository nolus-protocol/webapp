<template>
  <form
    class="modal-form"
    @submit.prevent="submit"
  >

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
          :balance="formatCurrentBalance(modelValue.selectedCurrency)"
          :set-input-value="setAmount"
          name="amountSupply"
          @input="handleAmountChange($event)"
          @update-currency="(event) => (modelValue.selectedCurrency = event)"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="modal-send-receive-actions">
      <button
        class="btn btn-primary btn-large-primary text-center min-h-[44px]"
        :class="{ 'js-loading': loading }"
        :disabled="!supply"
      >
        {{ loading ? '' : supply ? $t("message.supply") : $t("message.supply-limit-reached") }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import type { SupplyFormComponentProps } from "@/types/component/SupplyFormComponentProps";
import { onMounted, ref, type PropType } from "vue";
import type { AssetBalance } from "@/stores/wallet/state";

import CurrencyField from "@/components/CurrencyField.vue";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { EnvNetworkUtils } from "@/utils";
import { CONTRACTS } from "@/config/contracts";

const props = defineProps({
  modelValue: {
    type: Object as PropType<SupplyFormComponentProps>,
    required: true,
  },
});

const wallet = useWalletStore();
const supply = ref(true);
const loading = ref(true);

onMounted(() => {
  Promise.all([checkSupply()]).catch((e) => console.error(e));
});

const submit = () => {
  if (supply.value) {
    props.modelValue.onNextClick();
  }
}

const checkSupply = async () => {
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const lpp = new Lpp(
    cosmWasmClient,
    CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance
  );
  const data = await lpp.getDepositCapacity();
  if (Number(data?.amount) == 0) {
    supply.value = false;
  }
  loading.value = false;
}

const handleAmountChange = (value: string) => {
  props.modelValue.amount = value;
};

const formatCurrentBalance = (selectedCurrency: AssetBalance) => {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    const asset = wallet.getCurrencyInfo(
      props.modelValue.selectedCurrency.balance.denom
    );
    return CurrencyUtils.convertMinimalDenomToDenom(
      selectedCurrency.balance.amount.toString(),
      selectedCurrency.balance.denom,
      asset.shortName,
      asset.coinDecimals
    ).toString();
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

defineEmits(["update:modelValue.selectedCurrency"]);
</script>
