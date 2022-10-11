<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="currentComponent.props.selectedCurrency"
    :receiverAddress="currentComponent.props.receiverAddress"
    :password="currentComponent.props.password"
    :amount="currentComponent.props.amount"
    :txType="TX_TYPE.REPAY"
    :txHash="currentComponent.props.txHash"
    :step="step"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value: string) => currentComponent.props.password = value"
  />
  <!-- @TODO: Refactor to use <RepayFormComponent /> directly -->
  <component
    v-else
    :is="currentComponent.is"
    v-model="currentComponent.props"
  />
</template>

<!-- @TODO: Transition component to Composition API -->
<script setup lang="ts">
import type { LeaseData } from '@/types';
import type { RepayComponentProps } from '@/types/component';
import type { Coin } from '@cosmjs/proto-signing';
import type { AssetBalance } from '@/stores/wallet/state';

import RepayFormComponent from '@/components/RepayComponents/RepayFormComponent.vue';
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';

import { inject, onMounted, ref, watch, type PropType } from 'vue';
import { Lease } from '@nolus/nolusjs/build/contracts';
import { CurrencyUtils, NolusClient, NolusWallet } from '@nolus/nolusjs';
import { Dec, Int } from '@keplr-wallet/unit';

import { assetsInfo } from '@/config/assetsInfo';
import { CONFIRM_STEP } from '@/types';
import { TxType } from '@/types';
import { defaultNolusWalletFee } from '@/config/wallet';
import { getMicroAmount, walletOperation } from '@/components/utils';
import { useWalletStore } from '@/stores/wallet';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

interface RepayMainComponentData {
  is: typeof RepayFormComponent | typeof ConfirmComponent;
  props: RepayComponentProps;
}

const ScreenState = {
  MAIN: RepayFormComponent,
  CONFIRM: ConfirmComponent,
};

const walletStore = useWalletStore();
const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const onModalClose = inject('onModalClose', () => {});
const getLeases = inject('getLeases', () => {});

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);
const TX_TYPE = TxType;
const currentComponent = ref({} as RepayMainComponentData);
const leaseContract = {} as Lease;
const closeModal = onModalClose;
const updateLeases = getLeases;

const props = defineProps({
  leaseData: {
    type: Object as PropType<LeaseData>,
  },
});

onMounted(() => {
  const balances = walletStore.balances;
  currentComponent.value = {
    is: RepayFormComponent,
    props: initProps(),
  };

  if (balances) {
    currentComponent.value.props.selectedCurrency = balances[0];
  }
});

const initProps = () => {
  return {
    outstandingLoanAmount: props.leaseData?.leaseStatus?.opened?.amount || '',
    currentBalance: [] as AssetBalance[],
    selectedCurrency: {} as AssetBalance,
    receiverAddress: props.leaseData?.leaseAddress || '',
    amount: '',
    password: '',
    passwordErrorMsg: '',
    amountErrorMsg: '',
    txHash: '',
    onNextClick: () => onNextClick(),
  } as RepayComponentProps;
};

const onNextClick = async () => {
  if (isAmountValid()) {
    showConfirmScreen.value = true;
  }
};

const onSendClick = async () => {
  await walletOperation(repayLease, currentComponent.value.props.password);
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  closeModal();
};

const isAmountValid = (): boolean => {
  let isValid = true;
  const decimals = assetsInfo[currentComponent.value.props.selectedCurrency.balance.denom].coinDecimals;
  const amount = currentComponent.value.props.amount;
  const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
    amount,
    currentComponent.value.props.selectedCurrency.balance.denom,
    decimals
  ).amount.toString();
  const walletBalance = String(
    currentComponent.value.props.selectedCurrency?.balance?.amount || 0
  );

  if (microAmount || microAmount !== '') {
    currentComponent.value.props.amountErrorMsg = '';
    const isLowerThanOrEqualsToZero = new Int(microAmount).lt(new Int(1));
    const isGreaterThenBalance = new Int(microAmount).gt(
      new Int(walletBalance || '0')
    );

    if (isLowerThanOrEqualsToZero) {
      currentComponent.value.props.amountErrorMsg = i18n.t('message.invalid-balance-low');
      isValid = false;
    }
    if (isGreaterThenBalance) {
      currentComponent.value.props.amountErrorMsg = i18n.t('message.invalid-balance-big');
      isValid = false;
    }
  } else {
    currentComponent.value.props.amountErrorMsg = i18n.t('message.missing-amount');
    isValid = false;
  }

  return isValid;
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

const repayLease = async () => {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(
        currentComponent.value.props.selectedCurrency.balance.denom,
        currentComponent.value.props.amount
      );
      const funds: Coin[] = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString(),
        },
      ];
      const cosmWasmClient =
        await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(
        cosmWasmClient,
        currentComponent.value.props.receiverAddress
      );
      const result = await leaseClient.repayLease(
        wallet,
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

watch(walletRef.balances, (balances: AssetBalance[]) => {
  if (balances) {
    currentComponent.value.props.currentBalance = balances;
    if (!currentComponent.value.props.selectedCurrency) {
      currentComponent.value.props.selectedCurrency = balances[0];
    }
  }
});

watch(
  () => currentComponent.value.props?.amount,
  () => {
    const amount = currentComponent.value.props.amount;
    if (amount) {
      currentComponent.value.props.amount = new Dec(amount)
        .truncate()
        .toString();
      isAmountValid();
    }
  }
);
</script>
