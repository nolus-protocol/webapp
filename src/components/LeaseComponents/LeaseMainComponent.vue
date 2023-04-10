<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedDownPaymentCurrency"
    :receiverAddress="state.contractAddress"
    :password="state.password"
    :amount="state.downPayment"
    :memo="state.memo"
    :txType="TX_TYPE.LEASE"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value: string) => state.password = value"
  />
  <LeaseFormComponent
    v-else
    v-model="state"
    class="overflow-auto custom-scroll"
  />
</template>

<script setup lang="ts">
import LeaseFormComponent from "@/components/LeaseComponents/LeaseFormComponent.vue";
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";

import type { LeaseComponentProps } from "@/types/component/LeaseComponentProps";
import type { AssetBalance } from "@/stores/wallet/state";

import { inject, ref, watch, onMounted, onUnmounted } from "vue";
import { Leaser } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

import { CONTRACTS } from "@/config/contracts";
import { EnvNetworkUtils } from "@/utils/EnvNetworkUtils";
import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { getMicroAmount, walletOperation } from "@/components/utils";
import { useWalletStore } from "@/stores/wallet";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { computed } from "vue";
import { NATIVE_ASSET, GAS_FEES, SNACKBAR, GROUPS, LEASE_MIN_AMOUNT, LEASE_MAX_AMOUNT, TIP, WASM_EVENTS, INTEREST_DECIMALS, MAX_POSITION, DEFAULT_LTV } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { useOracleStore } from "@/stores/oracle";

const onModalClose = inject("onModalClose", () => { });
const walletStore = useWalletStore();
const oracle = useOracleStore();
const walletRef = storeToRefs(walletStore);
const i18n = useI18n();

const paymentBalances = computed(() => {
  const balances = walletStore.balances;
  return balances.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    return currency.groups.includes(GROUPS.Lease) || currency.groups.includes(GROUPS.Lpn);
  });
});

const leaseBalances = computed(() => {
  const balances = walletStore.balances;
  return balances.filter((item) => {
    const currency = walletStore.currencies[item.balance.denom];
    return currency.groups.includes(GROUPS.Lease);
  }).map((item) => {
    const asset = walletStore.getCurrencyInfo(item.balance.denom);
    return {
      ticker: asset.ticker,
      denom: asset.coinMinimalDenom,
      decimals: asset.coinDecimals
    }
  });
});

const step = ref(CONFIRM_STEP.CONFIRM);
const TX_TYPE = ref(TxType);
const showConfirmScreen = ref(false);

const props = defineProps({
  selectedAsset: {
    type: String
  }
});

const state = ref({
  contractAddress: CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance,
  currentBalance: walletStore.balances as AssetBalance[],
  selectedDownPaymentCurrency: paymentBalances.value[0] as AssetBalance,
  selectedCurrency: {
    balance: coin(0, leaseBalances.value[0].denom)
  } as AssetBalance,
  dialogSelectedCurrency: props.selectedAsset,
  downPayment: "",
  memo: "",
  password: "",
  passwordErrorMsg: "",
  onNextClick: (price) => onNextClick(price),
  downPaymentErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.open_lease + TIP.amount, NATIVE_ASSET.denom),
  leaseApply: null,
  position: MAX_POSITION,
  ltv: DEFAULT_LTV
} as LeaseComponentProps);

const getLeases = inject("getLeases", () => { });
const snackbarVisible = inject("snackbarVisible", () => false);
const showSnackbar = inject("showSnackbar", (_type: string, _transaction: string) => { });
let leaseAssetPrice: string | null;

onMounted(async () => {
  const balances = walletStore.balances;
  if (balances) {
    state.value.currentBalance = balances;
  }
});

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, "loading");
  }
});

watch(walletRef.balances, async (balances: AssetBalance[]) => {
  if (balances) {
    state.value.currentBalance = balances;
  }
});

watch(() => state.value.downPayment, () => {
  calculate();
});

watch(() => state.value.selectedDownPaymentCurrency, () => {
  calculate();
});

watch(() => state.value.selectedCurrency, () => {
  calculate();
});

watch(() => state.value.ltv, () => {
  calculate();
});

const calculate = async () => {
  try {
    const downPaymentAmount = state.value.downPayment;

    if (downPaymentAmount) {

      const microAmount = getMicroAmount(
        state.value.selectedDownPaymentCurrency.balance.denom,
        state.value.downPayment
      );

      if (isDownPaymentAmountValid()) {

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

        const leaserClient = new Leaser(
          cosmWasmClient,
          CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
        );

        const currency = walletStore.currencies[
          state.value.selectedDownPaymentCurrency.balance.denom
        ];

        const lease = walletStore.currencies[state.value.selectedCurrency.balance.denom];
        const makeLeaseApplyResp = await leaserClient.leaseQuote(
          microAmount.mAmount.amount.toString(),
          currency.ticker,
          lease.ticker,
          state.value.ltv
        );

        makeLeaseApplyResp.annual_interest_rate = makeLeaseApplyResp.annual_interest_rate / Math.pow(10, INTEREST_DECIMALS);
        state.value.leaseApply = makeLeaseApplyResp;
      }
    } else {
      state.value.leaseApply = null;
    }
  } catch (error) {
    state.value.leaseApply = null;
  }

}

const onNextClick = async (price: string) => {
  leaseAssetPrice = price;
  if (isDownPaymentAmountValid()) {
    showConfirmScreen.value = true;
  }
};

const onSendClick = async () => {
  try {
    await walletOperation(openLease, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
};

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  onModalClose();
};

const isDownPaymentAmountValid = (): boolean => {
  let isValid = true;
  state.value.downPaymentErrorMsg = "";

  const selectedDownPaymentDenom = state.value.selectedDownPaymentCurrency.balance.denom;
  const downPaymentAmount = state.value.downPayment;
  const currentBalance = getCurrentBalanceByDenom(selectedDownPaymentDenom);

  if (currentBalance) {

    if (downPaymentAmount || downPaymentAmount !== "") {

      const coinData = walletStore.getCurrencyInfo(
        currentBalance?.balance?.denom
      );
      const asset = walletStore.getCurrencyByTicker(coinData.ticker);
      const price = oracle.prices[asset.symbol];

      const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(downPaymentAmount, "", coinData.coinDecimals);
      const balance = CurrencyUtils.calculateBalance(price.amount, downPaymentAmountInMinimalDenom, coinData.coinDecimals).toDec();

      const leaseMax = new Dec(LEASE_MAX_AMOUNT.amount);
      const leaseMin = new Dec(LEASE_MIN_AMOUNT.amount);

      const isLowerThanOrEqualsToZero = new Dec(
        downPaymentAmountInMinimalDenom.amount || "0"
      ).lte(new Dec(0));

      const isGreaterThanWalletBalance = new Int(
        downPaymentAmountInMinimalDenom.amount.toString() || "0"
      ).gt(currentBalance?.balance?.amount);

      if (isLowerThanOrEqualsToZero) {
        state.value.downPaymentErrorMsg = i18n.t("message.invalid-balance-low");
        isValid = false;
      }

      if (isGreaterThanWalletBalance) {
        state.value.downPaymentErrorMsg = i18n.t("message.invalid-balance-big");
        isValid = false;
      }

      if (balance.lt(leaseMin)) {
        state.value.downPaymentErrorMsg = i18n.t("message.lease-min-error", {
          minAmount: (Math.ceil(LEASE_MIN_AMOUNT.amount / Number(price.amount) * 1000) / 1000),
          maxAmount: (Math.ceil(LEASE_MAX_AMOUNT.amount / Number(price.amount) * 1000) / 1000),
          symbol: coinData.coinAbbreviation
        });
        isValid = false;
      }

      if (balance.gt(leaseMax)) {
        state.value.downPaymentErrorMsg = i18n.t("message.lease-max-error", {
          minAmount: (Math.ceil(LEASE_MIN_AMOUNT.amount / Number(price.amount) * 1000) / 1000),
          maxAmount: (Math.ceil(LEASE_MAX_AMOUNT.amount / Number(price.amount) * 1000) / 1000),
          symbol: coinData.coinAbbreviation
        });
        isValid = false;
      }

    } else {
      state.value.downPaymentErrorMsg = i18n.t("message.missing-amount");
      isValid = false;
    }
  }

  return isValid;
};

const getCurrentBalanceByDenom = (denom: string) => {
  for (let currency of state.value.currentBalance) {
    if (currency.balance.denom == denom) {
      return currency;
    }
  }
};

const openLease = async () => {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isDownPaymentAmountValid()) {
    step.value = CONFIRM_STEP.PENDING;
    try {

      const microAmount = getMicroAmount(
        state.value.selectedDownPaymentCurrency.balance.denom,
        state.value.downPayment
      );


      const funds = [
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
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );
      const ticker = walletStore.currencies[
        state.value.selectedCurrency.balance.denom
      ].ticker;

      const { txHash, txBytes, usedFee } = await leaserClient.simulateOpenLeaseTx(
        wallet,
        ticker,
        state.value.ltv,
        funds
      );

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      const item = tx?.events.find((item) => {
        return item.type == WASM_EVENTS["wasm-ls-request-loan"].key;
      });

      const data = item?.attributes[WASM_EVENTS["wasm-ls-request-loan"].index];

      if (data && leaseAssetPrice) {

        const downPaymentAsset = walletStore.getCurrencyByTicker(walletStore.currencies[
          state.value.selectedDownPaymentCurrency.balance.denom
        ].ticker);

        const downPaymentPrice = oracle.prices[downPaymentAsset.symbol];
        const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(state.value.downPayment, "", Number(downPaymentAsset.decimal_digits));
        const balance = CurrencyUtils.calculateBalance(downPaymentPrice.amount, downPaymentAmountInMinimalDenom, Number(downPaymentAsset.decimal_digits)).toDec().toString();

        localStorage.setItem(data.value, JSON.stringify({
          downPayment: balance,
          price: leaseAssetPrice,
          leasePositionTicker: ticker
        }));
      }

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
</script>
