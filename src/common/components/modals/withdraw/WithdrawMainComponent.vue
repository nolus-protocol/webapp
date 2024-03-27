<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :amount="state.amount"
    :txType="$t(`message.${TxType.WITHDRAW}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onWithdrawClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
  />
  <WithdrawFormComponent
    v-else
    v-model="state"
    class="custom-scroll overflow-auto"
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
import type { WithdrawFormComponentProps } from "./types";

import ConfirmComponent from "@/common/components/modals/templates/ConfirmComponent.vue";
import WithdrawFormComponent from "./WithdrawFormComponent.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";

import { CONFIRM_STEP, type ExternalCurrency } from "@/common/types";
import { TxType } from "@/common/types";
import { Coin, Dec } from "@keplr-wallet/unit";
import { NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { Logger, WalletManager } from "@/common/utils";
import { getMicroAmount, validateAmount, walletOperation } from "@/common/utils";
import { WalletActions, useWalletStore } from "@/common/stores/wallet";
import { computed, inject, onBeforeMount, onMounted, ref, watch } from "vue";
import { NATIVE_ASSET, GAS_FEES, ErrorCodes } from "@/config/global";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/common/stores/application";
import { useAdminStore } from "@/common/stores/admin";

const props = defineProps({
  selectedAsset: {
    type: String
  }
});

const walletStore = useWalletStore();
const app = useApplicationStore();
const admin = useAdminStore();

const balances = computed(() => {
  const assets = [];
  const lpns = app.lpn?.map((item) => item.key) ?? [];

  for (const key in app.currenciesData ?? {}) {
    const currency = app.currenciesData![key];
    const c = { ...currency };
    const item = walletStore.balances.find((item) => item.balance.denom == currency.ibcData);
    if (item) {
      c.balance = item!.balance;
      assets.push(c);
    }
  }

  return assets.filter((item) => lpns.includes(item.key));
});

const selectedCurrency = computed(() => {
  const item = balances.value.find((item) => {
    let ibcData = app.lpn![0].ibcData;
    if (props.selectedAsset) {
      ibcData = app.currenciesData![props.selectedAsset!].ibcData;
    }
    return item.balance.denom == ibcData;
  });
  return item;
});

const showConfirmScreen = ref(false);
const state = ref({
  currentDepositBalance: {
    ...selectedCurrency.value,
    balance: coin(0, selectedCurrency.value?.balance.ibcData)
  } as ExternalCurrency,
  currentBalance: balances.value as ExternalCurrency[],
  selectedCurrency: selectedCurrency.value as ExternalCurrency,
  receiverAddress: "",
  amount: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.lender_burn_deposit, NATIVE_ASSET.denom),
  selectedAsset: props.selectedAsset,
  onNextClick: () => onNextClick(),
  onSendClick: () => onWithdrawClick(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn()
} as WithdrawFormComponentProps);

const errorDialog = ref({
  showDialog: false,
  errorMessage: "",
  tryAgain: (): void => {}
});

async function fetchDepositBalance() {
  try {
    const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const currency = state.value.selectedCurrency;
    const [_currency, protocol] = currency.key.split("@");

    const lppClient = new Lpp(cosmWasmClient, admin.contracts![protocol].lpp);
    const [depositBalance, price] = await Promise.all([
      lppClient.getLenderDeposit(walletAddress as string),
      lppClient.getPrice()
    ]);

    const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
    const amount = new Dec(depositBalance.balance).mul(calculatedPrice);

    state.value.currentDepositBalance = {
      ...state.value.selectedCurrency,
      balance: new Coin(state.value.selectedCurrency.balance.denom, amount.truncate().toString())
    } as ExternalCurrency;
  } catch (e: Error | any) {
    errorDialog.value.showDialog = true;
    errorDialog.value.errorMessage = e.message;
    errorDialog.value.tryAgain = fetchDepositBalance;
    Logger.error(e);
  }
}

onBeforeMount(() => {
  if (!props.selectedAsset) {
    state.value.selectedAsset = app.lpn![0].ibcData as string;
  }
});

onMounted(async () => {
  fetchDepositBalance();
});

watch(
  () => state.value.amount,
  (currentValue, oldValue) => {
    validateInputs();
  }
);

watch(
  () => state.value.selectedCurrency,
  (currentValue, oldValue) => {
    validateInputs();
    fetchDepositBalance();
  }
);

const step = ref(CONFIRM_STEP.CONFIRM);

const closeModal = inject("onModalClose", () => () => {});
const loadLPNCurrency = inject("loadLPNCurrency", () => false);

function onNextClick() {
  const currency = state.value.selectedCurrency;
  const [_currency, protocol] = currency.key.split("@");
  state.value.receiverAddress = admin.contracts![protocol].lpp;

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
    Number(state.value.currentDepositBalance?.balance.amount)
  );
}

async function onWithdrawClick() {
  try {
    await walletOperation(transferAmount);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function transferAmount() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && state.value.amountErrorMsg === "") {
    step.value = CONFIRM_STEP.PENDING;

    try {
      const microAmount = getMicroAmount(state.value.selectedCurrency.balance.denom, state.value.amount);

      const currency = state.value.selectedCurrency;
      const [_currency, protocol] = currency.key.split("@");

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(cosmWasmClient, admin.contracts![protocol].lpp);
      const price = await lppClient.getPrice();

      const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));

      if (microAmount.mAmount.amount.equals(state.value.currentDepositBalance?.balance.amount)) {
        const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
        const amount = await lppClient.getLenderDeposit(walletAddress as string);
        microAmount.mAmount.amount = new Dec(amount.balance).truncate();
      } else {
        microAmount.mAmount.amount = new Dec(microAmount.mAmount.amount).quo(calculatedPrice).truncate();
      }

      const { txHash, txBytes, usedFee } = await lppClient.simulateBurnDepositTx(
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
