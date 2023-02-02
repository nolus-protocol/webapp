<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :txType="TxType.SUPPLY"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onDelegateClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <DelegateFormComponent v-else v-model="state" />
  <Modal
    v-if="errorDialog.showDialog"
    @close-modal="errorDialog.showDialog = false"
    route="alert"
  >
    <ErrorDialog
      title="Error connecting"
      :message="errorDialog.errorMessage"
      :try-button="closeModal"
    />
  </Modal>
</template>

<script lang="ts" setup>
import type { SupplyFormComponentProps } from "@/types/component/SupplyFormComponentProps";

import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";
import DelegateFormComponent from "@/components/DelegateComponents/DelegateFormComponent.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { CONTRACTS } from "@/config/contracts";
import { EnvNetworkUtils } from "@/utils/EnvNetworkUtils";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { computed, inject, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { STAKING_VALIDATORS_NUMBER } from "@/config/env";

import {
  validateAmount,
  walletOperation,
} from "@/components/utils";

import {
  DEFAULT_APR,
  NATIVE_ASSET,
  GAS_FEES,
  SNACKBAR,
} from "@/config/env";
import { CurrencyUtils } from "@nolus/nolusjs";

const props = defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});

const i18n = useI18n();
const walletStore = useWalletStore();
const snackbarVisible = inject("snackbarVisible", () => false);

const selectedCurrency = computed(
  () =>
    walletStore.balances.find(
      (asset) => asset.balance.denom === props.selectedAsset
    ) || walletStore.balances[0]
);

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: walletStore.balances,
  selectedCurrency: selectedCurrency.value,
  amount: "",
  password: "",
  amountErrorMsg: "",
  currentAPR: `${DEFAULT_APR}%`,
  receiverAddress: CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance,
  txHash: "",
  fee: coin(GAS_FEES.lender_deposit, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
} as SupplyFormComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const errorDialog = ref({
  showDialog: false,
  errorMessage: "",
});

const closeModal = inject("onModalClose", () => () => {});
const showSnackbar = inject(
  "showSnackbar",
  (type: string, transaction: string) => {}
);

function onNextClick() {
  if (!state.value.receiverAddress) {
    errorDialog.value.showDialog = true;
    errorDialog.value.errorMessage = i18n.t("message.missing-receiver");
    return;
  }

  validateInputs();

  if (!state.value.amountErrorMsg) {
    showConfirmScreen.value = true;
  }
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  closeModal();
}

function validateInputs() {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );
}

async function onDelegateClick() {
  try {
    await walletOperation(delegate, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function delegate() {
  // try{
    const delegator = await walletStore[WalletActionTypes.LOAD_DELEGATOR_VALIDATORS]();
  //   let division = STAKING_VALIDATORS_NUMBER;

  //   if(delegator?.rewards?.length > 0){
  //     division = delegator?.rewards?.length;
  //   }

  //   const denom = state.value.selectedCurrency.balance.denom;
  //   const asset = walletStore.getCurrencyInfo(
  //     denom
  //   );
  //   const data = CurrencyUtils.convertDenomToMinimalDenom(
  //     state.value.amount,
  //     asset.coinDenom,
  //     asset.coinDecimals
  //   );
  //   const amount = Number(data.amount.toString());
  //   const quotient = Math.floor(amount / division);
  //   const remainder = amount % division;
  // }catch(error){
  //   step.value = CONFIRM_STEP.ERROR;
  // }

  
 console.log(await walletStore[WalletActionTypes.LOAD_DELEGATOR_VALIDATORS]());
  // console.log(await walletStore[WalletActionTypes.LOAD_VALIDATOR]("nolusvaloper1hmchunh8kpxgyddmcj6au4fttytg7qccmgx99n"));
}

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, state.value.txHash);
  }
});

watch(
  () => [...state.value.amount],
  (currentValue, oldValue) => {
    validateInputs();
  }
);

watch(
  () => [...state.value.selectedCurrency.balance.denom.toString()],
  (currentValue, oldValue) => {
    validateInputs();
  }
);
</script>
