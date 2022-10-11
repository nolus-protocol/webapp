<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="currentComponent.props.selectedCurrency"
    :receiverAddress="currentComponent.props.contractAddress"
    :password="currentComponent.props.password"
    :amount="currentComponent.props.amount"
    :memo="currentComponent.props.memo"
    :txType="TX_TYPE.LEASE"
    :txHash="currentComponent.props.txHash"
    :step="step"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value: string) => currentComponent.props.password = value"
  />
  <!-- @TODO  
    : Refactor to use <LeaseFormComponent /> directly -->
  <component
    v-else
    :is="currentComponent.is"
    v-model="currentComponent.props"
  />
</template>

<!-- @TODO: Transition component to Composition API -->
<script setup lang="ts">
import LeaseFormComponent from '@/components/LeaseComponents/LeaseFormComponent.vue';
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';
import type { LeaseComponentProps } from '@/types/component/LeaseComponentProps';
import type { AssetBalance } from '@/stores/wallet/state';

import { inject, onMounted, ref, shallowRef, watch } from 'vue';
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

interface LeaseMainComponentData {
  is: typeof LeaseFormComponent;
  props: LeaseComponentProps;
}

const onModalClose = inject('onModalClose', () => {});
const walletStore = useWalletStore();
const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const step = ref(CONFIRM_STEP.CONFIRM);
const TX_TYPE = ref(TxType);
const showConfirmScreen = ref(false);
const currentComponent = shallowRef({} as LeaseMainComponentData);

onMounted(() => {
  const balances = walletStore.balances;
  currentComponent.value = {
    is: LeaseFormComponent,
    props: initProps(),
  };
  if (balances) {
    currentComponent.value.props.currentBalance = balances;
    currentComponent.value.props.selectedCurrency = balances[0];
  }
});

watch(walletRef.balances, async (balances: AssetBalance[]) => {
  if (balances) {
    currentComponent.value.props.currentBalance = balances;

    if (!currentComponent.value.props.selectedCurrency) {
      currentComponent.value.props.selectedCurrency = balances[0];
    }
  }
});

watch(
  () => currentComponent.value?.props?.downPayment,
  async () => {
    const downPaymentAmount = currentComponent.value.props.downPayment;
    if (downPaymentAmount) {
      currentComponent.value.props.downPayment = new Dec(downPaymentAmount)
        .truncate()
        .toString();

      if (isDownPaymentAmountValid()) {
        const cosmWasmClient =
          await NolusClient.getInstance().getCosmWasmClient();
        const leaserClient = new Leaser(
          cosmWasmClient,
          CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
        );
        const makeLeaseApplyResp = await leaserClient.leaseQuote(
          currentComponent.value.props.downPayment,
          currentComponent.value.props.selectedDownPaymentCurrency.balance.denom
        );

        currentComponent.value.props.leaseApply = makeLeaseApplyResp;
        populateBorrow(makeLeaseApplyResp);
      }
    } else {
      currentComponent.value.props.amount = '';
      currentComponent.value.props.leaseApply = null;
    }
  }
);

watch(
  () => currentComponent.value?.props?.amount,
  async () => {
    const amount = currentComponent.value.props.amount;
    if (amount) {
      currentComponent.value.props.amount = new Dec(amount)
        .truncate()
        .toString();
      isAmountValid();
    }
  }
);

const initProps = () => {
  return {
    contractAddress:
      CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance,
    currentBalance: [] as AssetBalance[],
    selectedDownPaymentCurrency: {
      balance: new Coin(
        'ibc/8A34AF0C1943FD0DFCDE9ADBF0B2C9959C45E87E6088EA2FC6ADACD59261B8A2',
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
  } as LeaseComponentProps;
};

const onNextClick = async () => {
  if (isAmountValid() && isDownPaymentAmountValid()) {
    showConfirmScreen.value = true;
  }
};

const onSendClick = async () => {
  await walletOperation(openLease, currentComponent.value.props.password);
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  onModalClose();
};

const isPasswordValid = (): boolean => {
  let isValid = true;
  const passwordField = currentComponent.value.props.password;
  currentComponent.value.props.passwordErrorMsg = '';

  if (!passwordField) {
    isValid = false;
    currentComponent.value.props.passwordErrorMsg = i18n.t('message.empty-password');
  }

  return isValid;
};

const isDownPaymentAmountValid = (): boolean => {
  let isValid = true;
  const selectedDownPaymentDenom = currentComponent.value.props.selectedDownPaymentCurrency.balance.denom;
  const downPaymentAmount = currentComponent.value.props.downPayment;
  const currentBalance = getCurrentBalanceByDenom(selectedDownPaymentDenom);

  if (downPaymentAmount || downPaymentAmount !== '') {
    const decimals = assetsInfo[currentBalance.balance.denom].coinDecimals;
    currentComponent.value.props.downPaymentErrorMsg = '';
    const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(downPaymentAmount, '', decimals);
    const isLowerThanOrEqualsToZero = new Dec(
      downPaymentAmountInMinimalDenom.amount || '0'
    ).lte(new Dec(0));
    const isGreaterThanWalletBalance = new Int(
      downPaymentAmountInMinimalDenom.amount.toString() || '0'
    ).gt(currentBalance.balance.amount);
    if (isLowerThanOrEqualsToZero) {
      currentComponent.value.props.downPaymentErrorMsg = i18n.t('message.invalid-balance-low');
      isValid = false;
    }
    if (isGreaterThanWalletBalance) {
      currentComponent.value.props.downPaymentErrorMsg = i18n.t('message.invalid-balance-big');
      isValid = false;
    }
  } else {
    currentComponent.value.props.downPaymentErrorMsg = i18n.t('message.missing-amount');
    isValid = false;
  }

  return isValid;
};

const isAmountValid = (): boolean => {
  let isValid = true;
  const amount = currentComponent.value.props.amount;
  const leaseBorrowAmount = currentComponent.value.props.leaseApply?.borrow?.amount;

  if (!leaseBorrowAmount) {
    isValid = false;
  }

  if (isValid && (amount || amount !== '')) {
    currentComponent.value.props.amountErrorMsg = '';
    const isLowerThanOrEqualsToZero = new Int(amount).lt(new Int(1));
    const isGreaterThenBorrow = new Int(amount).gt(
      new Int(leaseBorrowAmount || '')
    );

    if (isLowerThanOrEqualsToZero) {
      currentComponent.value.props.amountErrorMsg = i18n.t('message.invalid-balance-low');
      isValid = false;
    }
    if (isGreaterThenBorrow) {
      currentComponent.value.props.amountErrorMsg = i18n.t('message.invalid-balance-big');
      isValid = false;
    }
  } else {
    currentComponent.value.props.amountErrorMsg = i18n.t('message.missing-amount');
    isValid = false;
  }

  return isValid;
};

const populateBorrow = (leaseApplyData: LeaseApply) => {
  if (!leaseApplyData) {
    return;
  }
  currentComponent.value.props.amount = leaseApplyData.borrow.amount;
  currentComponent.value.props.selectedCurrency = getCurrentBalanceByDenom(
    leaseApplyData.borrow.symbol
  );
};

const getCurrentBalanceByDenom = (denom: string) => {
  let result: AssetBalance = {} as AssetBalance;
  currentComponent.value.props.currentBalance.forEach((assetBalance) => {
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
        currentComponent.value.props.selectedCurrency.balance.denom,
        currentComponent.value.props.amount
      );
      const funds = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString(),
        },
      ];
      const cosmWasmClient =
        await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );
      const result = await leaserClient.openLease(
        wallet as NolusWallet,
        currentComponent.value.props.selectedCurrency.balance.denom,
        defaultNolusWalletFee(),
        funds
      );
      if (result) {
        currentComponent.value.props.txHash = result.transactionHash || '';
        step.value = CONFIRM_STEP.SUCCESS;
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
};
</script>
