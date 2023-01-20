<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :txType="TX_TYPE.REPAY"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value: string) => state.password = value"
  />
  <RepayFormComponent v-else v-model="state" />
</template>

<script setup lang="ts">
import type { LeaseData } from "@/types";
import type { RepayComponentProps } from "@/types/component";
import type { Coin } from "@cosmjs/proto-signing";
import type { AssetBalance } from "@/stores/wallet/state";

import RepayFormComponent from "@/components/RepayComponents/RepayFormComponent.vue";
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";

import {
  inject,
  onBeforeMount,
  onUnmounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONFIRM_STEP } from "@/types";
import { TxType } from "@/types";
import { defaultNolusWalletFee } from "@/config/wallet";
import { getMicroAmount, walletOperation } from "@/components/utils";
import { useWalletStore } from "@/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { NATIVE_ASSET, GAS_FEES, SNACKBAR } from "@/config/env";
import { coin } from "@cosmjs/amino";

const walletStore = useWalletStore();
const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const onModalClose = inject("onModalClose", () => {});
const showSnackbar = inject(
  "showSnackbar",
  (type: string, transaction: string) => {}
);
const snackbarVisible = inject("snackbarVisible", () => false);

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);
const TX_TYPE = TxType;

const closeModal = onModalClose;

const props = defineProps({
  leaseData: {
    type: Object as PropType<LeaseData>,
  },
});

const state = ref({
  outstandingLoanAmount: props.leaseData?.leaseStatus?.opened?.amount || "",
  currentBalance: walletStore.balances as AssetBalance[],
  selectedCurrency: {} as AssetBalance,
  receiverAddress: props.leaseData?.leaseAddress || "",
  amount: "",
  password: "",
  passwordErrorMsg: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.repay_lease, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
} as RepayComponentProps);

onBeforeMount(() => {
  const balances = walletStore.balances;

  if (balances) {
    const lease = props.leaseData;
    const item = balances.find((item) => {
      const currency = walletStore.getCurrencyInfo(item.balance.denom);
      return currency.ticker == lease?.leaseStatus?.opened?.amount?.ticker;
    });
    state.value.currentBalance = balances;
    state.value.selectedCurrency = item as AssetBalance;
  }
});

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, "loading");
  }
});

const onNextClick = async () => {
  if (isAmountValid()) {
    showConfirmScreen.value = true;
  }
};

const onSendClick = async () => {
  try {
    await walletOperation(repayLease, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  closeModal();
};

const isAmountValid = (): boolean => {
  let isValid = true;
  const decimals = walletStore.getCurrencyInfo(
    state.value.selectedCurrency.balance.denom
  ).coinDecimals;
  const amount = state.value.amount;
  const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
    amount,
    state.value.selectedCurrency.balance.denom,
    decimals
  ).amount.toString();
  const walletBalance = String(
    state.value.selectedCurrency?.balance?.amount || 0
  );

  if (microAmount || microAmount !== "") {
    state.value.amountErrorMsg = "";
    const isLowerThanOrEqualsToZero = new Int(microAmount).lt(new Int(1));
    const isGreaterThenBalance = new Int(microAmount).gt(
      new Int(walletBalance || "0")
    );

    if (isLowerThanOrEqualsToZero) {
      state.value.amountErrorMsg = i18n.t("message.invalid-balance-low");
      isValid = false;
    }
    if (isGreaterThenBalance) {
      state.value.amountErrorMsg = i18n.t("message.invalid-balance-big");
      isValid = false;
    }
  } else {
    state.value.amountErrorMsg = i18n.t("message.missing-amount");
    isValid = false;
  }

  return isValid;
};

const repayLease = async () => {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {
      const microAmount = getMicroAmount(
        state.value.selectedCurrency.balance.denom,
        state.value.amount
      );
      const funds: Coin[] = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString(),
        },
      ];
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(
        cosmWasmClient,
        state.value.receiverAddress
      );
      const result = await leaseClient.repayLease(
        wallet,
        defaultNolusWalletFee(),
        funds
      );

      if (result) {
        state.value.txHash = result.transactionHash || "";
        step.value = CONFIRM_STEP.SUCCESS;
        if (snackbarVisible()) {
          showSnackbar(SNACKBAR.Success, state.value.txHash);
        }
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR;
    }
  }
};

watch(walletRef.balances, (balances: AssetBalance[]) => {
  if (balances) {
    if (!state.value.selectedCurrency) {
      state.value.selectedCurrency = balances[0];
    }
  }
});

watch(
  () => state.value?.amount,
  () => {
    const amount = state.value.amount;
    if (amount) {
      state.value.amount = new Dec(amount).truncate().toString();
      isAmountValid();
    }
  }
);
</script>
