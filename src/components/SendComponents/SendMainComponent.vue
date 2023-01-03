<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :memo="state.memo"
    :txType="TxType.SEND"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <SendComponent v-else v-model="state"/>
</template>

<script lang="ts" setup>
import type { SendComponentProps } from '@/types/component/SendComponentProps';

import SendComponent from '@/components/SendComponents/SendComponent.vue';
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';

import { transferCurrency, validateAddress, validateAmount, walletOperation} from '@/components/utils';
import { CONFIRM_STEP } from '@/types/ConfirmStep';
import { TxType } from '@/types/TxType';
import { useWalletStore } from '@/stores/wallet';
import { computed, inject, onUnmounted, ref } from 'vue';
import { DEFAULT_ASSET, GAS_FEES, SNACKBAR } from '@/config/env';
import { coin } from '@cosmjs/amino';

const step = ref(CONFIRM_STEP.CONFIRM);
const walletStore = useWalletStore();

const closeModal = inject('onModalClose', () => () => {});
const snackbarVisible = inject('snackbarVisible', () => false);

const showSnackbar = inject('showSnackbar', (type: string, transaction: string) => {});
const balances = computed(() => walletStore.balances);

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value[0],
  amount: '',
  memo: '',
  receiverAddress: '',
  password: '',
  onNextClick,
  receiverErrorMsg: '',
  amountErrorMsg: '',
  fee: coin(GAS_FEES.transfer_amount, DEFAULT_ASSET.denom),
  txHash: '',
} as SendComponentProps);

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
}

const onClickOkBtn = () => {
  closeModal();
}

onUnmounted(() => {
  if(CONFIRM_STEP.PENDING == step.value){
    showSnackbar(SNACKBAR.Queued, state.value.txHash);
  }
});

const validateInputs = () => {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );

  state.value.receiverErrorMsg = validateAddress(state.value.receiverAddress);
}

const onSendClick = async () => {
  try{
    await walletOperation(transferAmount, state.value.password);
  }catch(error: Error | any){
    step.value = CONFIRM_STEP.ERROR;
  }
}

const transferAmount = async () => {
  step.value = CONFIRM_STEP.PENDING;
  const { success, txHash, txBytes, usedFee } = await transferCurrency(
    state.value.selectedCurrency.balance.denom,
    state.value.amount,
    state.value.receiverAddress,
    state.value.memo
  );

  if(success){
    state.value.txHash = txHash;

    if(usedFee?.amount?.[0]){
      state.value.fee = usedFee.amount[0];
    }

    try{
      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      if(snackbarVisible()){
        showSnackbar(isSuccessful ? SNACKBAR.Success: SNACKBAR.Error, txHash);
      }
    }catch(error){
      step.value = CONFIRM_STEP.ERROR;
    }

  }else{
    step.value  = CONFIRM_STEP.ERROR;
  }

}

function onNextClick(){
  validateInputs();

  if (!state.value.amountErrorMsg && !state.value.receiverErrorMsg) {
    showConfirmScreen.value = true;
  }
}
</script>
