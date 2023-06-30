<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :memo="state.memo"
    :txType="$t(`message.${TxType.SWAP}`)"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <SwapFormComponent
    v-else
    :selectedCurrency="state.selectedCurrency"
    :swapToSelectedCurrency="state.swapToSelectedCurrency"
    :currentBalance="state.currentBalance"
    :amount="state.amount"
    :errorMsg="state.errorMsg"
    :onSwapClick="onSwapClick"
    @updateSelected="(value: AssetBalance) => state.selectedCurrency = value"
    @updateAmount="(value: string) => state.amount = value"
    @updateSwapToSelected="(value: AssetBalance) => state.swapToSelectedCurrency = value"
  />
</template>

<script lang="ts" setup>
import type { AssetBalance } from "@/stores/wallet/state";

import SwapFormComponent from "./SwapFormComponent.vue";
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";

import { computed, inject, ref, watch } from "vue";
import { validateAmount, walletOperation } from "@/components/utils";
import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { useWalletStore } from "@/stores/wallet";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { NATIVE_ASSET, GAS_FEES } from "@/config/env";

const step = ref(CONFIRM_STEP.CONFIRM);
const wallet = useWalletStore();
const i18n = useI18n();

const closeModal = inject("onModalClose", () => () => {});
const balances = computed(() => wallet.balances);

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value[0],
  swapToSelectedCurrency: balances.value[0],
  amount: "",
  memo: "",
  receiverAddress: "",
  password: "",
  receiverErrorMsg: "",
  errorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.swap_amount, NATIVE_ASSET.denom),
});

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  closeModal();
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

  if (
    state.value.selectedCurrency.balance.denom ===
    state.value.swapToSelectedCurrency.balance.denom
  ) {
    state.value.errorMsg = i18n.t("message.swap-same-error");
  }
}

watch(
  () => [
    state.value.amount,
    state.value.selectedCurrency,
    state.value.swapToSelectedCurrency,
  ],
  () => {
    validateInputs();
  }
);

async function onSendClick() {
  await walletOperation(transferAmount, state.value.password);
}

async function transferAmount() {
  step.value = CONFIRM_STEP.PENDING;

  // @TODO: Implement swap action

  const mockedResponseSuccess = true;
  step.value = mockedResponseSuccess
    ? CONFIRM_STEP.SUCCESS
    : CONFIRM_STEP.ERROR;
  state.value.txHash = "test hash";
}
</script>
