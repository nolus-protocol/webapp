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
    :onSendClick="onWithdrawClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <WithdrawFormComponent v-else v-model="state" />
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
import type { AssetBalance } from '@/stores/wallet/state';
import type { WithdrawFormComponentProps } from '@/types/component/WithdrawFormComponentProps';

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';
import WithdrawFormComponent from '@/components/WithdrawComponents/WithdrawFormComponent.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import Modal from '@/components/modals/templates/Modal.vue';

import { CONFIRM_STEP } from '@/types/ConfirmStep';
import { TxType } from '@/types/TxType';
import { Coin, Int } from '@keplr-wallet/unit';
import { NolusClient, NolusWallet } from '@nolus/nolusjs';
import { Lpp } from '@nolus/nolusjs/build/contracts';
import { LPP_CONSTANTS } from '@/config/contracts';
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils';
import { getMicroAmount, validateAmount, walletOperation } from '@/components/utils';
import { defaultNolusWalletFee } from '@/config/wallet';
import { useWalletStore } from '@/stores/wallet';
import { computed, inject, onMounted, ref, watch } from 'vue';
import { WalletManager } from '@/wallet/WalletManager';

const { selectedAsset } = defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});

const walletStore = useWalletStore();

// @TODO: Fetch supplied balances instead of wallet balances
const balances = computed(() => {
  const balances = walletStore.balances;
  const lpp_coins = LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()];
  return balances.filter((item) => lpp_coins[item.balance.denom] );
});

const selectedCurrency = computed(
  () => balances.value.find((asset) => asset.balance.denom === selectedAsset) || balances.value[0]
);

const showConfirmScreen = ref(false);
const state = ref({
  currentDepositBalance: {} as any,
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  receiverAddress:
    LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][
      selectedCurrency.value.balance.denom
    ].instance,
  amount: '',
  password: '',
  amountErrorMsg: '',
  txHash: '',
  onNextClick: () => onNextClick(),
  onSendClick: () => onWithdrawClick(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn(),
} as WithdrawFormComponentProps);

const errorDialog = ref({
  showDialog: false,
  errorMessage: '',
  tryAgain: (): void => {},
});

const fetchDepositBalance = async () => {
  try {
    const walletAddress = walletStore.wallet?.address ?? WalletManager.getWalletAddress();
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const lppClient = new Lpp(cosmWasmClient, state.value.receiverAddress);
    const depositBalance = await lppClient.getLenderDeposit(
      walletAddress as string
    );

    state.value.currentDepositBalance = {
      balance: new Coin(
        state.value.selectedCurrency.balance.denom,
        new Int(depositBalance.balance)
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
    state.value.receiverAddress =
      LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][
        state.value.selectedCurrency.balance.denom
      ]?.instance || '';
  }
);

const step = ref(CONFIRM_STEP.CONFIRM);

const closeModal = inject('onModalClose', () => () => {});

function onNextClick() {
  if (!state.value.receiverAddress) {
    errorDialog.value.showDialog = true;
    errorDialog.value.errorMessage = 'Missing receiver address!';
    errorDialog.value.tryAgain = hideErrorDialog;
    return;
  }
  validateInputs();

  if (!state.value.amountErrorMsg) {
    showConfirmScreen.value = true;
  }
}

function hideErrorDialog() {
  errorDialog.value.showDialog = false;
  errorDialog.value.errorMessage = '';
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
  await walletOperation(transferAmount, state.value.password);
}

async function transferAmount() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && state.value.amountErrorMsg === '') {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(
        state.value.selectedCurrency.balance.denom,
        state.value.amount
      );
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const lppClient = new Lpp(
        cosmWasmClient,
        LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][
          state.value.selectedCurrency.balance.denom
        ].instance
      );
      const result = await lppClient.burnDeposit(
        wallet,
        microAmount.mAmount.amount.toString(),
        defaultNolusWalletFee(),
        [
          {
            denom: microAmount.coinMinimalDenom,
            amount: microAmount.mAmount.amount.toString(),
          },
        ]
      );
      if (result) {
        state.value.txHash = result.transactionHash || '';
        step.value = CONFIRM_STEP.SUCCESS;
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
}
</script>
