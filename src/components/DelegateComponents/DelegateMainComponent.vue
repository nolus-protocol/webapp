<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :receiverAddress="WalletManager.getWalletAddress()"
    :selectedCurrency="state.selectedCurrency"
    :password="state.password"
    :amount="state.amount"
    :txType="$t(`message.${TxType.SUPPLY}`)+':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onDelegateClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <DelegateFormComponent
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
      :try-button="closeModal"
    />
  </Modal>
</template>

<script lang="ts" setup>

import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";
import DelegateFormComponent from "@/components/DelegateComponents/DelegateFormComponent.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import type { DelegateFormComponentProps } from "@/types/component";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { inject, onUnmounted, ref, watch } from "vue";
import { coin } from "@cosmjs/amino";
import { ErrorCodes, STAKING } from "@/config/env";
import { validateAmount, walletOperation } from "@/components/utils";
import { NATIVE_ASSET, GAS_FEES, SNACKBAR, } from "@/config/env";
import { CurrencyUtils } from "@nolus/nolusjs";
import { WalletManager } from "@/utils";
import { Utils } from "@/utils/Utils";

defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});

const walletStore = useWalletStore();
const snackbarVisible = inject("snackbarVisible", () => false);
const loadDelegated = inject("loadDelegated", () => false);

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: walletStore.balances.filter((item) => {
    if(item.balance.denom == NATIVE_ASSET.denom){
      return true;
    }
    return false;
  }),
  selectedCurrency: walletStore.balances[0],
  amount: "",
  password: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.delegation, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
} as DelegateFormComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const errorDialog = ref({
  showDialog: false,
  errorMessage: "",
});

const closeModal = inject("onModalClose", () => () => { });
const showSnackbar = inject(
  "showSnackbar",
  (type: string, transaction: string) => { }
);

watch(() => [state.value.selectedCurrency, state.value.amount], () => {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );
})

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
    console.log(error)
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function delegate() {
  try {

    if (walletStore.wallet && state.value.amountErrorMsg === "") {
      step.value = CONFIRM_STEP.PENDING;

      let validators = await getValidators();
      let division = STAKING.VALIDATORS_NUMBER;

      if (validators?.length > 0) {
        division = validators?.length;
      }

      const denom = state.value.selectedCurrency.balance.denom;
      const asset = walletStore.getCurrencyInfo(
        denom
      );

      const data = CurrencyUtils.convertDenomToMinimalDenom(
        state.value.amount,
        asset.coinDenom,
        asset.coinDecimals
      );

      const amount = Number(data.amount.toString());
      const quotient = Math.floor(amount / division);
      const remainder = amount % division;
      const amounts = [];

      validators = validators.sort((a: any, b: any) => {
        return Number(b.commission.commission_rates.rate) - Number(a.commission.commission_rates.rate);
      });

      for (const v of validators) {
        amounts.push({
          value: quotient,
          validator: v.operator_address
        });
      }

      amounts[0].value += remainder;

      const delegations = amounts.map((item) => {
        return {
          validator: item.validator,
          amount: coin(item.value, denom)
        }
      });

      const { txHash, txBytes, usedFee } = await walletStore.wallet.simulateDelegateTx(delegations);
      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      loadDelegated();
      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }

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

async function getValidators() {
  const delegatorValidators = await walletStore[WalletActionTypes.LOAD_DELEGATOR_VALIDATORS]();

  if (delegatorValidators.length > 0) {
    return delegatorValidators;
  }

  let validators = await walletStore[WalletActionTypes.LOAD_VALIDATORS]();
  let loadedValidators = [];

  if (validators.length > STAKING.SLICE) {
    validators = validators.slice(STAKING.SLICE).filter((item: any) => {
      const date = new Date(item.unbonding_time);
      const time = Date.now() - date.getTime();

      if (time > STAKING.SLASHED_DAYS && !item.jailed) {
        return true;
      }

      return false;
    }).filter((item: any) => {
      const commission = Number(item.commission.commission_rates.rate);
      if (commission <= STAKING.PERCENT) {
        return true;
      }
      return false;
    });
  }

  for (let i = 0; i < STAKING.VALIDATORS_NUMBER; i++) {
    const index = Utils.getRandomInt(0, validators.length);
    loadedValidators.push(validators[index]);
    validators.splice(index, 1);
  }

  return loadedValidators;

}

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, state.value.txHash);
  }
});

watch(
  () => [...state.value.amount],
  (_currentValue, _oldValue) => {
    validateInputs();
  }
);

watch(
  () => [...state.value.selectedCurrency.balance.denom.toString()],
  (_currentValue, _oldValue) => {
    validateInputs();
  }
);
</script>
