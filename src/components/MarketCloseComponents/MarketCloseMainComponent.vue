<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :txType="$t(`message.${TxType.MARKET_CLOSE}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value: string) => state.password = value"
  />
  <MarketCloseFormComponent
    v-else
    v-model="state"
    class="overflow-auto custom-scroll"
  />
</template>

<script setup lang="ts">
import type { LeaseData } from "@/types";
import type { MarketCloseComponentProps } from "@/types/component";
import type { Coin } from "@cosmjs/proto-signing";
import type { AssetBalance } from "@/stores/wallet/state";

import MarketCloseFormComponent from "@/components/MarketCloseComponents/MarketCloseFormComponent.vue";
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
import { NATIVE_ASSET, GAS_FEES, SNACKBAR, TIP, ErrorCodes } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { ApptUtils } from "@/utils/AppUtils";
import { useLeaseConfig } from "@/composables";
import { useOracleStore } from "@/stores/oracle";

const walletStore = useWalletStore();
const walletRef = storeToRefs(walletStore);
const oracle = useOracleStore();
const i18n = useI18n();

const onModalClose = inject("onModalClose", () => { });
const showSnackbar = inject("showSnackbar", (type: string, transaction: string) => { });
const snackbarVisible = inject("snackbarVisible", () => false);
const getLeases = inject("getLeases", () => { });

const step = ref(CONFIRM_STEP.CONFIRM);
const showConfirmScreen = ref(false);

const closeModal = onModalClose;
const { config } = useLeaseConfig(
  (error: Error | any) => { },
);

const props = defineProps({
  leaseData: {
    type: Object as PropType<LeaseData>,
  },
});

const balances = computed(() => {
  const balances = walletStore.balances;
  const ticker = props.leaseData?.leaseStatus?.opened?.amount?.ticker;

  return balances.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    return currency.ticker == ticker;
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
  fee: coin(GAS_FEES.market_close_lease + TIP.amount, NATIVE_ASSET.denom),
  swapFee: 0,
  onNextClick: () => onNextClick(),
} as MarketCloseComponentProps);

onMounted(async () => {
  setSwapFee();
})

watch(() => state.value.selectedCurrency, () => {
  setSwapFee();
})

watch(
  () => [...state.value.amount],
  (currentValue, oldValue) => {
    isAmountValid();
  }
);

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
    await walletOperation(marketCloseLease, state.value.password);
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
  // let isValid = true;
  // state.value.amountErrorMsg = "";

  // const amount = state.value.amount;
  // const currency = walletStore.getCurrencyByTicker(state.value.leaseInfo.amount.ticker);
  // const debt = new Dec(state.value.leaseInfo.amount.amount, Number(currency.decimal_digits));
  // const minAmountCurrency = walletStore.getCurrencyByTicker(config.value?.config.lease_position_spec.min_asset.ticker as string);
  // const minAmont = new Dec(config.value?.config.lease_position_spec.min_asset.amount ?? 0, Number(minAmountCurrency.decimal_digits));
  // const price = new Dec(oracle.prices[currency.symbol].amount);

  // if (amount || amount !== "") {

  //   const amountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, "", Number(currency.decimal_digits));
  //   const value = new Dec(amountInMinimalDenom.amount, Number(currency.decimal_digits));

  //   const isLowerThanOrEqualsToZero = new Dec(
  //     amountInMinimalDenom.amount || "0"
  //   ).lte(new Dec(0));


  //   if (isLowerThanOrEqualsToZero) {
  //     state.value.amountErrorMsg = i18n.t("message.invalid-balance-low");
  //     isValid = false;
  //   }

  //   if (value.gt(debt)) {
  //     state.value.amountErrorMsg = i18n.t("message.lease-only-max-error", {
  //       maxAmount: Number(debt.toString(Number(currency.decimal_digits))),
  //       symbol: currency.shortName
  //     });
  //     isValid = false;
  //   }else if (!value.equals(debt) && debt.sub(value).mul(price).lte(minAmont)) {
  //     state.value.amountErrorMsg = i18n.t("message.lease-min-amount", {
  //       amount: Number(minAmont.quo(price).toString(Number(currency.decimal_digits))),
  //       symbol: currency.shortName
  //     });
  //     isValid = false;
  //   }

  // } else {
  //   state.value.amountErrorMsg = i18n.t("message.missing-amount");
  //   isValid = false;
  // }

  // return isValid;
  return true;
};

const marketCloseLease = async () => {
  // const wallet = walletStore.wallet as NolusWallet;
  // if (wallet && isAmountValid()) {
  //   step.value = CONFIRM_STEP.PENDING;
  //   try {

  //     const microAmount = getMicroAmount(
  //       state.value.selectedCurrency.balance.denom,
  //       state.value.amount
  //     );

  //     const currency = walletStore.getCurrencyInfo(state.value.selectedCurrency.balance.denom);
  //     const amount = new Int(state.value.leaseInfo.amount.amount);

  //     const funds: Coin[] = [
  //       {
  //         denom: TIP.denom,
  //         amount: TIP.amount.toString()
  //       }
  //     ];

  //     const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  //     const leaseClient = new Lease(
  //       cosmWasmClient,
  //       state.value.receiverAddress
  //     );

  //     const { txHash, txBytes, usedFee } = await leaseClient.simulateClosePositionLeaseTx(
  //       wallet,
  //       amount.equals(microAmount.mAmount.amount) ? undefined : {
  //         ticker: currency.ticker,
  //         amount: microAmount.mAmount.amount.toString(),
  //       },
  //       funds
  //     );

  //     state.value.txHash = txHash;

  //     if (usedFee?.amount?.[0]) {
  //       state.value.fee = usedFee.amount[0];
  //     }

  //     const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
  //     const isSuccessful = tx?.code === 0;
  //     step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

  //     if (snackbarVisible()) {
  //       showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
  //     }

  //     getLeases();
  //   } catch (error: Error | any) {
  //     console.log(error.message);
  //     switch (error.code) {
  //       case (ErrorCodes.GasError): {
  //         step.value = CONFIRM_STEP.GasError;
  //         break;
  //       }
  //       default: {
  //         step.value = CONFIRM_STEP.ERROR;
  //         break;
  //       }
  //     }
  //   }
  // }
};

watch(walletRef.balances, (b: AssetBalance[]) => {
  if (b) {
    if (!state.value.selectedCurrency) {
      state.value.selectedCurrency = balances.value[0];
    }
  }
});

</script>
