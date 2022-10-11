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
import { computed, inject, ref } from 'vue';

const step = ref(CONFIRM_STEP.CONFIRM);
const walletStore = useWalletStore();

const closeModal = inject('onModalClose', () => () => {});
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
  txHash: '',
} as SendComponentProps);

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  closeModal();
}

function onNextClick() {
  validateInputs();

  if (!state.value.amountErrorMsg && !state.value.receiverErrorMsg) {
    showConfirmScreen.value = true;
  }
}

function validateInputs() {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );

  state.value.receiverErrorMsg = validateAddress(state.value.receiverAddress);
}

async function onSendClick() {
  try{
    await walletOperation(transferAmount, state.value.password);
  }catch(error: Error | any){
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function transferAmount() {
  step.value = CONFIRM_STEP.PENDING;
  const { success, txHash } = await transferCurrency(
    state.value.selectedCurrency.balance.denom,
    state.value.amount,
    state.value.receiverAddress,
    state.value.memo
  );

  step.value = success ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
  state.value.txHash = txHash;
}
</script>
