<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :receiverAddress="WalletManager.getWalletAddress()"
    :selectedCurrency="state.selectedCurrency"
    :amount="state.amount"
    :txType="$t(`message.${TxType.UNDELEGATE}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onUndelegateClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
  />
  <UndelegateFormComponent
    v-else
    v-model="state"
  />
  <Modal
    v-if="errorDialog.showDialog"
    @close-modal="errorDialog.showDialog = false"
    route="alert"
  >
    <ErrorDialog
      title="Error connecting"
      :message="errorDialog.errorMessage"
      :try-button="errorDialog.tryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import type { UndelegateFormComponentProps } from "./types";

import ConfirmComponent from "../templates/ConfirmComponent.vue";
import UndelegateFormComponent from "./UndelegateFormComponent.vue";
import ErrorDialog from "../ErrorDialog.vue";
import Modal from "../templates/Modal.vue";

import { CONFIRM_STEP } from "@/common/types";
import { TxType } from "@/common/types";
import { Dec } from "@keplr-wallet/unit";
import { NetworkUtils, walletOperation } from "@/common/utils";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { inject, onMounted, ref, watch } from "vue";
import { NATIVE_ASSET, GAS_FEES, ErrorCodes } from "@/config/global";
import { coin } from "@cosmjs/amino";
import { useI18n } from "vue-i18n";
import { CurrencyUtils } from "@nolus/nolusjs";
import { WalletManager } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";

const walletStore = useWalletStore();
const app = useApplicationStore();

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: [{ balance: walletStore.total_unls.balance, ...app.native }],
  selectedCurrency: { balance: walletStore.total_unls.balance, ...app.native },
  amount: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.undelegation, NATIVE_ASSET.denom),
  delegated: null,
  undelegations: [],
  delegatedData: [],
  onNextClick: () => onNextClick()
} as UndelegateFormComponentProps);

let delegatedData: any = [];
let decimalDelegated = new Dec(0);

const i18n = useI18n();
const step = ref(CONFIRM_STEP.CONFIRM);
const errorDialog = ref({
  showDialog: false,
  errorMessage: "",
  tryAgain: (): void => {}
});

watch(
  () => [state.value.selectedCurrency, state.value.amount],
  () => {
    validateInputs();
  }
);

onMounted(async () => {
  const [delegated, undelegations] = await Promise.all([
    NetworkUtils.loadDelegations(),
    NetworkUtils.loadUnboundingDelegations()
  ]);

  delegatedData = delegated;
  state.value.undelegations = undelegations;

  for (const item of delegatedData) {
    const d = new Dec(item.balance.amount);
    decimalDelegated = decimalDelegated.add(d);
  }

  state.value.delegated = coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom);
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

const closeModal = inject("onModalClose", () => () => {});
const loadDelegated = inject("loadDelegated", () => false);

function onNextClick() {
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
  const amount = state.value.amount;
  state.value.amountErrorMsg = "";

  if (!amount) {
    state.value.amountErrorMsg = i18n.t("message.invalid-amount");
    return false;
  }

  const asset = state.value.selectedCurrency;
  const zero = CurrencyUtils.convertDenomToMinimalDenom("0", asset.ibcData, asset.decimal_digits).amount.toDec();
  const amountToTransfer = CurrencyUtils.convertDenomToMinimalDenom(amount, asset.ibcData, asset.decimal_digits);

  const isLowerThanOrEqualsToZero = amountToTransfer.amount.toDec().lte(zero);

  if (isLowerThanOrEqualsToZero) {
    state.value.amountErrorMsg = i18n.t("message.invalid-balance-low");
    return false;
  }

  const isGreaterThanWalletBalance = amountToTransfer.amount.toDec().gt(decimalDelegated);

  if (isGreaterThanWalletBalance) {
    state.value.amountErrorMsg = i18n.t("message.invalid-balance-big");
    return false;
  }

  return true;
}

async function onUndelegateClick() {
  try {
    await walletOperation(undelegate);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function undelegate() {
  if (walletStore.wallet) {
    try {
      const amount = state.value.amount;
      const asset = state.value.selectedCurrency;
      const amountToTransfer = CurrencyUtils.convertDenomToMinimalDenom(amount, asset.ibcData, asset.decimal_digits);

      let amountToTransferDecimal = amountToTransfer.amount.toDec();
      const transactions = [];
      step.value = CONFIRM_STEP.PENDING;

      for (const item of delegatedData) {
        const amount = new Dec(item.balance.amount);

        const rest = amountToTransferDecimal.sub(amount);

        if (rest.isNegative() || rest.isZero()) {
          const transfer = new Dec(amountToTransferDecimal.toString());
          transactions.push({
            validator: item.delegation.validator_address,
            amount: coin(transfer.truncate().toString(), asset.ibcData)
          });
          break;
        } else {
          const transfer = new Dec(amount.toString());
          transactions.push({
            validator: item.delegation.validator_address,
            amount: coin(transfer.truncate().toString(), asset.ibcData)
          });
        }

        amountToTransferDecimal = rest;
      }

      const { txHash, txBytes, usedFee } = await walletStore.wallet.simulateUndelegateTx(transactions);
      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      loadDelegated();

      await walletStore[WalletActions.UPDATE_BALANCES]();
    } catch (error: Error | any) {
      switch (error.code) {
        case ErrorCodes.GasError: {
          step.value = CONFIRM_STEP.GasError;
          break;
        }
        default: {
          step.value = CONFIRM_STEP.ERROR;
          break;
        }
      }
    }
  }
}
</script>
