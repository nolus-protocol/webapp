<template>
  <ConfirmComponent
    v-if='showConfirmScreen'
    :selectedCurrency='state.selectedCurrency'
    receiver-address=''
    :password="state.password"
    :amount="state.amount"
    :txType="TxType.CLAIM"
    :txHash="state.txHash"
    :step="step"
    :onSendClick="onClickClaim"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
</template>

<script lang="ts" setup>
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';
import type { ClaimComponentProps } from '@/types/component/ClaimComponentProps';
import type { ContractData } from '@nolus/nolusjs/build/contracts';

import { CONFIRM_STEP } from '@/types/ConfirmStep';
import { TxType } from '@/types/TxType';
import { defaultNolusWalletFee } from '@/config/wallet';
import { walletOperation } from '@/components/utils';
import { computed, inject, type PropType, ref } from 'vue';
import { useWalletStore } from '@/stores/wallet';

const walletStore = useWalletStore();

const props = defineProps({
  reward: {
    type: Object as PropType<any>,
    required: true,
  },
  contractData: {
    type: Array as PropType<ContractData[]>,
  },
});

// @TODO: Fetch supplied balances instead of wallet balances
const balances = computed(() => walletStore.balances);
const selectedCurrency = computed(
  () =>
    balances.value.find(
      (asset) => asset.balance.denom === props.reward.balance.denom
    ) || balances.value[0]
);
const showConfirmScreen = ref(true);

const state = ref({
  currentDepositBalance: {} as any,
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  amount: props.reward.balance.amount.toString(),
  password: '',
  txHash: '',
  onNextClick: () => onNextClick(),
  onSendClick: () => onClickClaim(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn(),
} as ClaimComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const closeModal = inject('onModalClose', () => () => {});

function onNextClick() {}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
  closeModal();
}

function onClickOkBtn() {
  closeModal();
}

async function onClickClaim() {
  await walletOperation(requestClaim, state.value.password);
}

async function requestClaim() {
  const wallet = walletStore.wallet;
  if (!props.contractData) {
    // TODO show error
  }
  if (wallet) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const result = await wallet.executeContractSubMsg(
        props.contractData as ContractData[],
        defaultNolusWalletFee(),
        undefined,
        undefined
      );

      if (result) {
        state.value.txHash = result.transactionHash || '';
        step.value = CONFIRM_STEP.SUCCESS;
      } else {
        step.value = CONFIRM_STEP.ERROR;
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
}
</script>
