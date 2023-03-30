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
    :onSendClick="onSupplyClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <SupplyFormComponent v-else v-model="state" />
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
import SupplyFormComponent from "@/components/SupplyComponents/SupplyFormComponent.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { CONTRACTS } from "@/config/contracts";
import { EnvNetworkUtils } from "@/utils/EnvNetworkUtils";
import { useWalletStore } from "@/stores/wallet";
import { computed, inject, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";

import {
  getMicroAmount,
  validateAmount,
  walletOperation,
} from "@/components/utils";

import {
  DEFAULT_APR,
  NATIVE_ASSET,
  GAS_FEES,
  GROUPS,
  SNACKBAR,
} from "@/config/env";

const props = defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});

const i18n = useI18n();
const walletStore = useWalletStore();
const snackbarVisible = inject("snackbarVisible", () => false);
const loadLPNCurrency = inject("loadLPNCurrency", () => false);

const balances = computed(() => {
  const b = walletStore.balances;
  return b.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    return currency.groups.includes(GROUPS.Lpn);
  });
});

const selectedCurrency = computed(
  () => {
    const b =  balances.value.find(
      (asset) => asset.balance.denom === props.selectedAsset
    );
    return b;
  }
   
);
const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  amount: "",
  password: "",
  amountErrorMsg: "",
  currentAPR: `${DEFAULT_APR}%`,
  receiverAddress:
    CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance,
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

async function onSupplyClick() {
  try {
    await walletOperation(transferAmount, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function transferAmount() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && state.value.amountErrorMsg === "") {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(
        state.value.selectedCurrency.balance.denom,
        state.value.amount
      );

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance
      );

      const { txHash, txBytes, usedFee } = await lppClient.simulateDepositTx(
        wallet,
        [
          {
            denom: microAmount.coinMinimalDenom,
            amount: microAmount.mAmount.amount.toString(),
          },
        ]
      );

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      loadLPNCurrency();
      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
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
