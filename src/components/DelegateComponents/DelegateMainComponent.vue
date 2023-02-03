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

import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";
import DelegateFormComponent from "@/components/DelegateComponents/DelegateFormComponent.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import type { DelegateFormComponentProps } from "@/types/component";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { CONTRACTS } from "@/config/contracts";
import { EnvNetworkUtils } from "@/utils/EnvNetworkUtils";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { computed, inject, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { STAKING } from "@/config/env";

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
  fee: coin(GAS_FEES.delegation, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
} as DelegateFormComponentProps);

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
    console.log(error)
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function delegate() {
  try{

    if(walletStore.wallet && state.value.amountErrorMsg === ""){
      step.value = CONFIRM_STEP.PENDING;

      let validators = await getValidators();
      let division = STAKING.VALIDATORS_NUMBER;
  
      if(validators?.length > 0){
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
  
      for(const v of validators){
        amounts.push({
          value: quotient,
          validator: v.operator_address
        });
      }
  
      amounts[0].value+=remainder;
  
      const delegations = amounts.map((item) => {
        return {
          validator: item.validator,
          amount: coin(item.value, denom)
        }
      });
  
      const { txHash, txBytes, usedFee } = await walletStore.wallet?.simulateDelegateTx(delegations);
      state.value.txHash = txHash;
  
      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }
  
      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }

    }

  }catch(error){
    console.log(error)
    step.value = CONFIRM_STEP.ERROR;
  }
}

const getValidators: () => any = async () => {
  const delegatorValidators = await walletStore[WalletActionTypes.LOAD_DELEGATOR_VALIDATORS]();
  
  if(delegatorValidators.length > 0){
    return delegatorValidators;
  }

  let validators = await walletStore[WalletActionTypes.LOAD_VALIDATORS]();
  let loadedValidators = [];

  if(validators.length > STAKING.SLICE){
    validators = validators.slice(STAKING.SLICE).filter((item: any) => {
      const date = new Date(item.unbonding_time);
      const time = Date.now() - date.getTime();
      if(time > STAKING.SLASHED_DAYS){
        return true;
      }
      return false;
    }).filter((item: any) => {
      const commission = Number(item.commission.commission_rates.rate);
      if(commission <= STAKING.PERCENT){
        return true;
      }
      return false;
    });
  }

  for(let i = 0; i < STAKING.VALIDATORS_NUMBER; i++){
    const index = getRandomInt(0, validators.length);
    loadedValidators.push(validators[index]);
    validators.splice(index, 1);
  }

  return loadedValidators;

}

const getRandomInt = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
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
