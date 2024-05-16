<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :receiverAddress="WalletManager.getWalletAddress()"
    :selectedCurrency="state.selectedCurrency"
    :amount="state.amount"
    :txType="$t(`message.${TxType.SUPPLY}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onDelegateClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
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
import type { DelegateFormComponentProps } from "./types";

import ConfirmComponent from "../templates/ConfirmComponent.vue";
import DelegateFormComponent from "./DelegateFormComponent.vue";
import ErrorDialog from "../ErrorDialog.vue";
import Modal from "../templates/Modal.vue";

import { CONFIRM_STEP } from "@/common/types";
import { TxType } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { inject, ref, watch } from "vue";
import { coin } from "@cosmjs/amino";
import { ErrorCodes, STAKING } from "@/config/global";
import { Logger, NetworkUtils, validateAmount, walletOperation } from "@/common/utils";
import { NATIVE_ASSET, GAS_FEES } from "@/config/global";
import { CurrencyUtils } from "@nolus/nolusjs";
import { WalletManager } from "@/common/utils";
import { Utils } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";

const walletStore = useWalletStore();
const app = useApplicationStore();
console.log(app.currenciesData);
const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: [{ balance: walletStore.total_unls.balance, ...app.native }],
  selectedCurrency: { balance: walletStore.total_unls.balance, ...app.native },
  amount: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.delegation, "ibc/7DABB27AEEAFC0576967D342F21DC0944F5EA6584B45B9C635A3B3C35DCDA159"),
  onNextClick: () => onNextClick()
} as DelegateFormComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const errorDialog = ref({
  showDialog: false,
  errorMessage: ""
});

const loadDelegated = inject("loadDelegated", () => false);
const closeModal = inject("onModalClose", () => {});

watch(
  () => [state.value.selectedCurrency, state.value.amount],
  () => {
    state.value.amountErrorMsg = validateAmount(
      state.value.amount,
      state.value.selectedCurrency.balance.denom,
      Number(state.value.selectedCurrency.balance.amount)
    );
  }
);

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
    await walletOperation(delegate);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
    Logger.error(error);
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

      const asset = state.value.selectedCurrency;
      const data = CurrencyUtils.convertDenomToMinimalDenom(state.value.amount, asset.ibcData, asset.decimal_digits);

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
          amount: coin(item.value, asset.ibcData)
        };
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
    }

    await walletStore.UPDATE_BALANCES();
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

async function getValidators() {
  const delegatorValidators = await NetworkUtils.loadDelegatorValidators();

  if (delegatorValidators.length > 0) {
    return delegatorValidators;
  }

  let validators = await NetworkUtils.loadValidators();
  let loadedValidators = [];
  if (validators.length > STAKING.SLICE) {
    validators = validators
      .slice(STAKING.SLICE)
      .filter((item: any) => {
        const date = new Date(item.unbonding_time);
        const time = Date.now() - date.getTime();

        if (time > STAKING.SLASHED_DAYS && !item.jailed) {
          return true;
        }

        return false;
      })
      .filter((item: any) => {
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

watch(
  () => state.value.amount,
  (_currentValue, _oldValue) => {
    validateInputs();
  }
);

watch(
  () => state.value.selectedCurrency,
  (_currentValue, _oldValue) => {
    validateInputs();
  }
);
</script>
