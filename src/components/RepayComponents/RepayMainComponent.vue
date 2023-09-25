<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :txType="$t(`message.${TxType.REPAY}`)+':'"
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

import { computed, inject, onUnmounted, ref, watch, type PropType, onMounted } from "vue";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONFIRM_STEP } from "@/types";
import { TxType } from "@/types";
import { getMicroAmount, walletOperation } from "@/components/utils";
import { useWalletStore } from "@/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { NATIVE_ASSET, GAS_FEES, SNACKBAR, TIP, PERMILLE, PERCENT, calculateAditionalDebt, ErrorCodes, IGNORE_LEASE_ASSETS } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { useOracleStore } from "@/stores/oracle";
import { AssetUtils } from "@/utils";
import { useApplicationStore } from "@/stores/application";
import { ApptUtils } from "@/utils/AppUtils";

const walletStore = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const onModalClose = inject("onModalClose", () => { });
const showSnackbar = inject("showSnackbar", (type: string, transaction: string) => { });
const snackbarVisible = inject("snackbarVisible", () => false);
const getLeases = inject("getLeases", () => { });

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);

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
    if(IGNORE_LEASE_ASSETS.includes(currency.ticker)){
      return false;
    }
    return app.lease.includes(currency.ticker) || currency.ticker == app.lpn?.ticker;
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
  swapFee: 0,
  onNextClick: () => onNextClick(),
} as RepayComponentProps);

onMounted(async () => {
  setSwapFee();
})

watch(() => state.value.selectedCurrency, () => {
  setSwapFee();
})

const setSwapFee = async () => {
  const asset = walletStore.getCurrencyInfo(state.value.selectedCurrency.balance.denom);
  state.value.swapFee = (await ApptUtils.getSwapFee())[asset.ticker] ?? 0;

}
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

      let debt = outStandingDebt();
      const swap = hasSwapFee();

      if (swap) {
        debt = debt.add(debt.mul(new Dec(state.value.swapFee)));
      }

      const debtInCurrencies = debt.quo(new Dec(price.amount));


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

      if (balance.gt(debt)) {
        state.value.amountErrorMsg = i18n.t("message.lease-only-max-error", {
          maxAmount: Number(debtInCurrencies.toString(Number(coinData.coinDecimals))),
          symbol: coinData.shortName
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
    } catch (error: Error | any) {
      switch(error.code){
        case(ErrorCodes.GasError): {
          step.value = CONFIRM_STEP.GasError;
          break;
        }
        default: {
          step.value = CONFIRM_STEP.ERROR;
          break;
        }
      }
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

const outStandingDebt = () => {
  const data = state.value.leaseInfo;
  const info = AssetUtils.getAssetInfo(data.principal_due.ticker);
  const additional = new Dec(additionalInterest().roundUp(), info.coinDecimals);
  const debt = new Dec(data.principal_due.amount, info.coinDecimals)
    .add(new Dec(data.previous_margin_due.amount, info.coinDecimals))
    .add(new Dec(data.previous_interest_due.amount, info.coinDecimals))
    .add(new Dec(data.current_margin_due.amount, info.coinDecimals))
    .add(new Dec(data.current_interest_due.amount, info.coinDecimals))
    .add(additional)
  return debt;
}

const additionalInterest = () => {
  const data = state.value.leaseInfo;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount)
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0)
}

const hasSwapFee = () => {
  const selectedCurrencyInfo = walletStore.getCurrencyInfo(state.value.selectedCurrency.balance.denom as string);
  const isLpn = app.lpn?.ticker == selectedCurrencyInfo.ticker;
  if (isLpn) {
    return false;
  }
  return true;
}


watch(walletRef.balances, (b: AssetBalance[]) => {
  if (b) {
    if (!state.value.selectedCurrency) {
      state.value.selectedCurrency = balances.value[0];
    }
  }
});

</script>
