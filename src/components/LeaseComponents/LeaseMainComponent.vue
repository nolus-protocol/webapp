<template>
  <ConfirmComponent 
    v-if="showConfirmScreen" 
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.contractAddress" 
    :password="state.password" 
    :amount="state.amount" 
    :memo="state.memo"
    :txType="TX_TYPE.LEASE" 
    :txHash="state.txHash" 
    :step="step" 
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick" 
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value: string) => state.password = value" />
  <LeaseFormComponent v-else v-model="state" />
</template>

<script setup lang="ts">
import LeaseFormComponent from '@/components/LeaseComponents/LeaseFormComponent.vue';
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';
import type { LeaseComponentProps } from '@/types/component/LeaseComponentProps';
import type { AssetBalance } from '@/stores/wallet/state';

import { inject, ref, watch, onMounted } from 'vue';
import { Leaser, type LeaseApply } from '@nolus/nolusjs/build/contracts';
import { CurrencyUtils, NolusClient, NolusWallet } from '@nolus/nolusjs';
import { Coin, Dec, Int } from '@keplr-wallet/unit';

import { CONTRACTS } from '@/config/contracts';
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils';
import { assetsInfo } from '@/config/assetsInfo';
import { CONFIRM_STEP } from '@/types/ConfirmStep';
import { TxType } from '@/types/TxType';
import { defaultNolusWalletFee } from '@/config/wallet';
import { getMicroAmount, walletOperation } from '@/components/utils';
import { useWalletStore } from '@/stores/wallet';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

const onModalClose = inject('onModalClose', () => { });
const walletStore = useWalletStore();
const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const step = ref(CONFIRM_STEP.CONFIRM);
const TX_TYPE = ref(TxType);
const showConfirmScreen = ref(false);
const state = ref({
  contractAddress: CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance,
  currentBalance: [] as AssetBalance[],
  selectedDownPaymentCurrency: {
    balance: new Coin(
      assetsInfo['ibc/fj29fj0fj'].coinMinimalDenom,
      0
    ),
  } as AssetBalance,
  selectedCurrency: {} as AssetBalance,
  downPayment: '',
  amount: '',
  memo: '',
  password: '',
  passwordErrorMsg: '',
  onNextClick: () => onNextClick(),
  receiverErrorMsg: '',
  amountErrorMsg: '',
  downPaymentErrorMsg: '',
  txHash: '',
  leaseApply: null,
} as LeaseComponentProps);
const getLease = inject('getLeases', () => {});

onMounted(() => {
  const balances = walletStore.balances;
  if (balances) {
    state.value.currentBalance = balances;
    state.value.selectedCurrency = balances[0];
  }
});

watch(walletRef.balances, async (balances: AssetBalance[]) => {
  if (balances) {
    state.value.currentBalance = balances;
    if (!state.value.selectedCurrency) {
      state.value.selectedCurrency = balances[0];
    }
  }
});

watch(
  () => state.value.downPayment,
  async () => {
    const downPaymentAmount = state.value.downPayment;
    if (downPaymentAmount) {

      state.value.downPayment = new Dec(downPaymentAmount)
        .truncate()
        .toString();

      if (isDownPaymentAmountValid()) {
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const leaserClient = new Leaser(
          cosmWasmClient,
          CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
        );
        const makeLeaseApplyResp = await leaserClient.leaseQuote(
          state.value.downPayment,
          state.value.selectedDownPaymentCurrency.balance.denom
        );

        state.value.leaseApply = makeLeaseApplyResp;
        populateBorrow(makeLeaseApplyResp);
      }
    } else {
      state.value.amount = '';
      state.value.leaseApply = null;
    }
  }
);

watch(
  () => state.value.amount,
  async () => {
    const amount = state.value.amount;
    if (amount) {
      state.value.amount = new Dec(amount)
        .truncate()
        .toString();
      isAmountValid();
    }
  }
);


const onNextClick = async () => {
  if (isAmountValid() && isDownPaymentAmountValid()) {
    showConfirmScreen.value = true;
  }
};

const onSendClick = async () => {
  await walletOperation(openLease, state.value.password);
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  onModalClose();
};

const isDownPaymentAmountValid = (): boolean => {
  let isValid = true;
  const selectedDownPaymentDenom = state.value.selectedDownPaymentCurrency.balance.denom;
  const downPaymentAmount = state.value.downPayment;
  const currentBalance = getCurrentBalanceByDenom(selectedDownPaymentDenom);

  if (downPaymentAmount || downPaymentAmount !== '') {
    const decimals = assetsInfo[currentBalance.balance.denom].coinDecimals;
    state.value.downPaymentErrorMsg = '';
    const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(downPaymentAmount, '', decimals);
    const isLowerThanOrEqualsToZero = new Dec(
      downPaymentAmountInMinimalDenom.amount || '0'
    ).lte(new Dec(0));
    const isGreaterThanWalletBalance = new Int(
      downPaymentAmountInMinimalDenom.amount.toString() || '0'
    ).gt(currentBalance.balance.amount);
    if (isLowerThanOrEqualsToZero) {
      state.value.downPaymentErrorMsg = i18n.t('message.invalid-balance-low');
      isValid = false;
    }
    if (isGreaterThanWalletBalance) {
      state.value.downPaymentErrorMsg = i18n.t('message.invalid-balance-big');
      isValid = false;
    }
  } else {
    state.value.downPaymentErrorMsg = i18n.t('message.missing-amount');
    isValid = false;
  }

  return isValid;
};

const isAmountValid = (): boolean => {
  let isValid = true;
  const amount = state.value.amount;
  const leaseBorrowAmount = state.value.leaseApply?.borrow?.amount;

  if (!leaseBorrowAmount) {
    isValid = false;
  }

  if (isValid && (amount || amount !== '')) {
    state.value.amountErrorMsg = '';
    const isLowerThanOrEqualsToZero = new Int(amount).lt(new Int(1));
    const isGreaterThenBorrow = new Int(amount).gt(
      new Int(leaseBorrowAmount || '')
    );

    if (isLowerThanOrEqualsToZero) {
      state.value.amountErrorMsg = i18n.t('message.invalid-balance-low');
      isValid = false;
    }
    if (isGreaterThenBorrow) {
      state.value.amountErrorMsg = i18n.t('message.invalid-balance-big');
      isValid = false;
    }
  } else {
    state.value.amountErrorMsg = i18n.t('message.missing-amount');
    isValid = false;
  }

  return isValid;
};

const populateBorrow = (leaseApplyData: LeaseApply) => {

  if (!leaseApplyData) {
    return;
  }
  state.value.amount = leaseApplyData.borrow.amount;
  state.value.selectedCurrency = getCurrentBalanceByDenom(
    (leaseApplyData.borrow as any).symbol
  );
};

const getCurrentBalanceByDenom = (denom: string) => {
  let result: AssetBalance = {} as AssetBalance;
  state.value.currentBalance.forEach((assetBalance) => {
    if (assetBalance.balance.denom === denom) {
      result = assetBalance as AssetBalance;
    }
  });
  return result;
};

const openLease = async () => {
  const wallet = walletStore.wallet;
  if (wallet && isAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(
        state.value.selectedCurrency.balance.denom,
        state.value.amount
      );
      const funds = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString(),
        },
      ];
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );
      const result = await leaserClient.openLease(
        wallet as NolusWallet,
        state.value.selectedCurrency.balance.denom,
        defaultNolusWalletFee(),
        funds
      );
      if (result) {
        state.value.txHash = result.transactionHash || '';
        step.value = CONFIRM_STEP.SUCCESS;
      }
      getLease();
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
};
</script>
