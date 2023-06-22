<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :txType="TxType.WITHDRAW"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onWithdrawClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <WithdrawFormComponent
    v-else
    v-model="state"
    class="overflow-auto custom-scroll"
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
import type { AssetBalance } from "@/stores/wallet/state";
import type { WithdrawFormComponentProps } from "@/types/component/WithdrawFormComponentProps";

import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";
import WithdrawFormComponent from "@/components/WithdrawComponents/WithdrawFormComponent.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { EnvNetworkUtils, WalletManager } from "@/utils";
import {
  getMicroAmount,
  validateAmount,
  walletOperation,
} from "@/components/utils";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { CONTRACTS } from "@/config/contracts";
import { NATIVE_ASSET, GAS_FEES, SNACKBAR, ErrorCodes } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/stores/application";

const props = defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});

const walletStore = useWalletStore();
const app = useApplicationStore();

const balances = computed(() => {
  const balances = walletStore.balances;
  return balances.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    return currency.ticker == app.lpn?.ticker;
  });
});

const selectedCurrency = computed(
  () =>
    balances.value.find(
      (asset) => asset.balance.denom === props.selectedAsset
    ) || balances.value[0]
);

const showConfirmScreen = ref(false);
const state = ref({
  currentDepositBalance: {} as any,
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  receiverAddress: CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance,
  amount: "",
  password: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.lender_burn_deposit, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
  onSendClick: () => onWithdrawClick(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn(),
} as WithdrawFormComponentProps);

const errorDialog = ref({
  showDialog: false,
  errorMessage: "",
  tryAgain: (): void => { },
});

const fetchDepositBalance = async () => {
  try {
    const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const lppClient = new Lpp(cosmWasmClient, state.value.receiverAddress);
    const [depositBalance, price] = await Promise.all([
      lppClient.getLenderDeposit(
        walletAddress as string
      ),
      lppClient.getPrice()
    ]);

    const calculatedPrice = new Dec(price.amount_quote.amount).quo(
      new Dec(price.amount.amount)
    );
    const amount = new Dec(depositBalance.balance).mul(calculatedPrice);

    state.value.currentDepositBalance = {
      balance: new Coin(
        state.value.selectedCurrency.balance.denom,
        amount.truncate().toString()
      ),
    } as AssetBalance;
  } catch (e: Error | any) {
    errorDialog.value.showDialog = true;
    errorDialog.value.errorMessage = e.message;
    errorDialog.value.tryAgain = fetchDepositBalance;
  }
};

onMounted(async () => {
  fetchDepositBalance();
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
    fetchDepositBalance();
  }
);

const step = ref(CONFIRM_STEP.CONFIRM);

const closeModal = inject("onModalClose", () => () => { });
const showSnackbar = inject(
  "showSnackbar",
  (type: string, transaction: string) => { }
);
const snackbarVisible = inject("snackbarVisible", () => false);
const loadLPNCurrency = inject("loadLPNCurrency", () => false);

function onNextClick() {
  if (!state.value.receiverAddress) {
    errorDialog.value.showDialog = true;
    errorDialog.value.errorMessage = "Missing receiver address!";
    errorDialog.value.tryAgain = hideErrorDialog;
    return;
  }
  validateInputs();

  if (!state.value.amountErrorMsg) {
    showConfirmScreen.value = true;
  }
}

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, state.value.txHash);
  }
});

function hideErrorDialog() {
  errorDialog.value.showDialog = false;
  errorDialog.value.errorMessage = "";
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
    Number(state.value.currentDepositBalance.balance.amount)
  );
}

async function onWithdrawClick() {
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
      const lppClient = new Lpp(cosmWasmClient, state.value.receiverAddress);
      const price = await lppClient.getPrice()

      const calculatedPrice = new Dec(price.amount_quote.amount).quo(
        new Dec(price.amount.amount)
      );

      if (microAmount.mAmount.amount.equals(state.value.currentDepositBalance.balance.amount)) {
        const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
        const amount = await lppClient.getLenderDeposit(
          walletAddress as string
        );
        microAmount.mAmount.amount = new Dec(amount.balance).truncate();
      } else {
        microAmount.mAmount.amount = new Dec(microAmount.mAmount.amount).quo(calculatedPrice).truncate();
      }

      const { txHash, txBytes, usedFee } =
        await lppClient.simulateBurnDepositTx(
          wallet,
          microAmount.mAmount.amount.toString()
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
      await walletStore[WalletActionTypes.UPDATE_BALANCES]();

    } catch (error: Error | any) {
      switch(error.code){
        case(ErrorCodes.GasError): {
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
