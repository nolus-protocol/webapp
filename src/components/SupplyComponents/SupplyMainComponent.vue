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
    :onSendClick="onSupplyClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <SupplyFormComponent v-else v-model="state"/>
  <Modal
    v-if="errorDialog.showDialog"
    @close-modal="errorDialog.showDialog = false"
  >
    <ErrorDialog
      title="Error connecting"
      :message="errorDialog.errorMessage"
      :try-button="closeModal"
    />
  </Modal>
</template>

<script lang="ts" setup>
import type { SupplyFormComponentProps } from '@/types/component/SupplyFormComponentProps';

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';
import SupplyFormComponent from '@/components/SupplyComponents/SupplyFormComponent.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import Modal from '@/components/modals/templates/Modal.vue';

import { getMicroAmount, validateAmount, walletOperation } from '@/components/utils';
import { CONFIRM_STEP } from '@/types/ConfirmStep';
import { TxType } from '@/types/TxType';
import { NolusClient, NolusWallet } from '@nolus/nolusjs';
import { Lpp } from '@nolus/nolusjs/build/contracts';
import { LPP_CONSTANTS } from '@/config/contracts';
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils';
import { defaultNolusWalletFee } from '@/config/wallet';
import { useWalletStore } from '@/stores/wallet';
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { selectedAsset } = defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});

const i18n = useI18n();
const walletStore = useWalletStore();
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
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  amount: '',
  password: '',
  amountErrorMsg: '',
  currentAPR: '24.21%',
  receiverAddress:
    LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][
      selectedCurrency.value.balance.denom
    ]?.instance,
  txHash: '',
  onNextClick: () => onNextClick(),
} as SupplyFormComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const errorDialog = ref({
  showDialog: false,
  errorMessage: '',
});

const closeModal = inject('onModalClose', () => () => {});

function onNextClick() {
  if (!state.value.receiverAddress) {
    errorDialog.value.showDialog = true;
    errorDialog.value.errorMessage = i18n.t('message.missing-receiver');
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

async function onSupplyClick() {
  await walletOperation(transferAmount, state.value.password);
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
      const lppClient = new Lpp(
        cosmWasmClient,
        LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][
          state.value.selectedCurrency.balance.denom
        ].instance
      );
      const result = await lppClient.deposit(wallet, defaultNolusWalletFee(), [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString(),
        },
      ]);
      if (result) {
        state.value.txHash = result.transactionHash || "";
        step.value = CONFIRM_STEP.SUCCESS;
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
}

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
    state.value.receiverAddress =
      LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][
        state.value.selectedCurrency.balance.denom
      ]?.instance || "";
  }
);
</script>
