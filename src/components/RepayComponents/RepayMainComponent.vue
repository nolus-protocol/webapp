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
  <RepayFormComponent
    v-else
    v-model="state"
    class="overflow-auto custom-scroll"
  />
</template>

<script setup lang="ts">
import type { LeaseData } from "@/types";
import type { RepayComponentProps } from "@/types/component";
import type { Coin } from "@cosmjs/proto-signing";
import type { AssetBalance } from "@/stores/wallet/state";

import RepayFormComponent from "@/components/RepayComponents/RepayFormComponent.vue";
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";

import { computed, inject, onUnmounted, ref, watch, type PropType } from "vue";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONFIRM_STEP } from "@/types";
import { TxType } from "@/types";
import { getMicroAmount, walletOperation } from "@/components/utils";
import { useWalletStore } from "@/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { NATIVE_ASSET, GAS_FEES, SNACKBAR, GROUPS, TIP, LEASE_MAX_AMOUNT, LEASE_MIN_AMOUNT } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { useOracleStore } from "@/stores/oracle";

const walletStore = useWalletStore();
const oracle = useOracleStore();

const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const onModalClose = inject("onModalClose", () => { });
const showSnackbar = inject("showSnackbar", (type: string, transaction: string) => { });
const snackbarVisible = inject("snackbarVisible", () => false);
const getLeases = inject("getLeases", () => { });

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);
const TX_TYPE = TxType;

const closeModal = onModalClose;

const props = defineProps({
  leaseData: {
    type: Object as PropType<LeaseData>,
  },
});

const balances = computed(() => {
  const balances = walletStore.balances;
  return balances.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    return currency.groups.includes(GROUPS.Lease) || currency.groups.includes(GROUPS.Lpn);
  });
});

const state = ref({
  leaseInfo: props.leaseData?.leaseStatus?.opened,
  currentBalance: balances.value as AssetBalance[],
  selectedCurrency: balances.value[0] as AssetBalance,
  receiverAddress: props.leaseData?.leaseAddress || "",
  amount: "",
  password: "",
  passwordErrorMsg: "",
  amountErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.repay_lease + TIP.amount, NATIVE_ASSET.denom),
  onNextClick: () => onNextClick(),
} as RepayComponentProps);

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
  state.value.amountErrorMsg = "";

  const selectedPaymentDenom = state.value.selectedCurrency.balance.denom;
  const amount = state.value.amount;
  const currentBalance = getCurrentBalanceByDenom(selectedPaymentDenom);

  if (currentBalance) {

    if (amount || amount !== "") {

      const coinData = walletStore.getCurrencyInfo(
        currentBalance?.balance?.denom
      );
      const asset = walletStore.getCurrencyByTicker(coinData.ticker);
      const price = oracle.prices[asset.symbol];

      const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, "", coinData.coinDecimals);
      const balance = CurrencyUtils.calculateBalance(price.amount, amountInMinimalDenom, coinData.coinDecimals).toDec();

      const leaseMax = new Dec(LEASE_MAX_AMOUNT);
      const leaseMin = new Dec(LEASE_MIN_AMOUNT);

      const isLowerThanOrEqualsToZero = new Dec(
        amountInMinimalDenom.amount || "0"
      ).lte(new Dec(0));

      const isGreaterThanWalletBalance = new Int(
        amountInMinimalDenom.amount.toString() || "0"
      ).gt(currentBalance?.balance?.amount);

      if (isLowerThanOrEqualsToZero) {
        state.value.amountErrorMsg = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (isGreaterThanWalletBalance) {
        state.value.amountErrorMsg = i18n.t("message.invalid-balance-big");
        isValid = false;
      }

      if (balance.lt(leaseMin)) {
        state.value.amountErrorMsg = i18n.t("message.lease-min-error", {
          amount: Math.ceil(LEASE_MIN_AMOUNT / Number(price.amount) * 1000) / 1000,
          symbol: coinData.coinAbbreviation
        });
        isValid = false;
      }

      if (balance.gt(leaseMax)) {
        state.value.amountErrorMsg = i18n.t("message.lease-max-error", {
          amount: Math.ceil(LEASE_MAX_AMOUNT / Number(price.amount) * 1000) / 1000,
          symbol: coinData.coinAbbreviation
        });
        isValid = false;
      }

    } else {
      state.value.amountErrorMsg = i18n.t("message.missing-amount");
      isValid = false;
    }
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
        {
          denom: TIP.denom,
          amount: TIP.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(
        cosmWasmClient,
        state.value.receiverAddress
      );

      const { txHash, txBytes, usedFee } = await leaseClient.simulateRepayLeaseTx(
        wallet,
        funds
      );

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

      getLeases();
    } catch (e) {
      console.log(e)
      step.value = CONFIRM_STEP.ERROR;
    }
  }
};

const getCurrentBalanceByDenom = (denom: string) => {
  for (let currency of state.value.currentBalance) {
    if (currency.balance.denom == denom) {
      return currency;
    }
  }
};

watch(walletRef.balances, (b: AssetBalance[]) => {
  if (b) {
    if (!state.value.selectedCurrency) {
      state.value.selectedCurrency = balances.value[0];
    }
  }
});

watch(
  () => state.value?.amount,
  () => {
    isAmountValid();
  }
);
</script>
