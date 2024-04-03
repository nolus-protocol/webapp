<template>
  <SwapFormComponent
    :selectedCurrency="state.selectedCurrency"
    :swapToSelectedCurrency="state.swapToSelectedCurrency"
    :currentBalance="state.currentBalance"
    :amount="state.amount"
    :swapToAmount="state.swapToAmount"
    :errorMsg="state.errorMsg"
    :onSwapClick="onSwapClick"
    @updateSelected="updateSelected"
    @updateAmount="updateAmount"
    @updateSwapToSelected="updateSwapToSelected"
    @updateSwapToAmount="updateSwapToAmount"
  />
</template>

<script lang="ts" setup>
import SwapFormComponent from "./SwapFormComponent.vue";

import { computed, inject, ref, watch } from "vue";
import { validateAmount, walletOperation } from "@/common/utils";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { useWalletStore } from "@/common/stores/wallet";
import { GAS_FEES, NATIVE_ASSET } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { SWAP_CURRENCIE } from "@/config/currencies";
import type { ExternalCurrency } from "@/common/types";

const wallet = useWalletStore();
const app = useApplicationStore();
const i18n = useI18n();

const closeModal = inject("onModalClose", () => () => {});
const balances = computed(() => {
  const assets = [];

  for (const key in app.currenciesData ?? {}) {
    const currency = app.currenciesData![key];
    const c = { ...currency };
    const item = wallet.balances.find((item) => item.balance.denom == currency.ibcData);

    if (item) {
      c.balance = item!.balance;
      assets.push(c);
    }
  }

  return assets;
});

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value.find((item) => item.ticker == SWAP_CURRENCIE)!,
  swapToSelectedCurrency: balances.value.find((item) => item.ticker == NATIVE_ASSET.ticker)!,
  amount: "",
  swapToAmount: "",
  receiverAddress: "",
  receiverErrorMsg: "",
  errorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.swap_amount, NATIVE_ASSET.denom)
});

function updateAmount(value: string) {
  state.value.amount = value;
}

function updateSwapToAmount(value: string) {
  state.value.swapToAmount = value;
}

function updateSelected(value: ExternalCurrency) {
  state.value.selectedCurrency = value;
}

function updateSwapToSelected(value: ExternalCurrency) {
  state.value.swapToSelectedCurrency = value;
}

function onSwapClick() {
  validateInputs();

  if (!state.value.errorMsg) {
    showConfirmScreen.value = true;
  }
}

function validateInputs() {
  state.value.errorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );

  if (state.value.selectedCurrency.balance.denom === state.value.swapToSelectedCurrency.balance.denom) {
    state.value.errorMsg = i18n.t("message.swap-same-error");
  }
}

watch(
  () => [
    state.value.amount,
    state.value.swapToAmount,
    state.value.selectedCurrency,
    state.value.swapToSelectedCurrency
  ],
  () => {
    validateInputs();
  }
);

async function onSendClick() {
  await walletOperation(transferAmount);
}

async function transferAmount() {
  // step.value = CONFIRM_STEP.PENDING;
  // // @TODO: Implement swap action
  // const mockedResponseSuccess = true;
  // step.value = mockedResponseSuccess ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
  // state.value.txHash = "test hash";
}
</script>
