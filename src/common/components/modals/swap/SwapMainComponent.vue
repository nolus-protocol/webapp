<template>
  <ConfirmSwapComponent
    v-if="showConfirmScreen"
    :txType="$t(`message.${TxType.SWAP}`) + ':'"
    :txHash="[state.txHash]"
    :step="step"
    :fee="state.fee"
    :errorMsg="state.errorMsg"
    :txs="route!.txsRequired"
    :swap-amount="`${state.amount} ${state.selectedCurrency?.shortName}`"
    :for-amount="`${state.swapToAmount} ${state.swapToSelectedCurrency?.shortName}`"
    :onSendClick="onSendClick"
    :onBackClick="onReset"
    :onOkClick="() => closeModal()"
  />

  <SwapFormComponent
    v-else
    :selectedCurrency="state.selectedCurrency"
    :swapToSelectedCurrency="state.swapToSelectedCurrency"
    :currentBalance="balances"
    :amount="state.amount"
    :swapToAmount="state.swapToAmount"
    :errorMsg="state.errorMsg"
    :loading="state.loading"
    :disabled="state.disabled"
    :fee="state.fee"
    :priceImpact="route?.swapPriceImpactPercent ?? '0'"
    :onSwapClick="onSwapClick"
    :swapFee="state.swapFee"
    :disableForm="state.disableForm"
    @updateSelected="updateSelected"
    @updateAmount="updateAmount"
    @updateSwapToSelected="updateSwapToSelected"
    @updateSwapToAmount="updateSwapToAmount"
    @changeFields="onChangeFields"
  />
</template>

<script lang="ts" setup>
import { TxType, type ExternalCurrency, type IObjectKeys, CONFIRM_STEP } from "@/common/types";
import { Dec, type Coin, Int } from "@keplr-wallet/unit";
import type { BaseWallet } from "@/networks";
import SwapFormComponent from "./SwapFormComponent.vue";
import ConfirmSwapComponent from "../templates/ConfirmSwapComponent.vue";

import { computed, inject, onMounted, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { useWalletStore } from "@/common/stores/wallet";
import { GAS_FEES, NATIVE_ASSET } from "@/config/global";
import { CurrencyUtils } from "@nolus/nolusjs";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";

import {
  AppUtils,
  AssetUtils,
  EnvNetworkUtils,
  Logger,
  SkipRouter,
  WalletUtils,
  externalWallet,
  validateAmount,
  walletOperation
} from "@/common/utils";

const wallet = useWalletStore();
const i18n = useI18n();
const timeOut = 600;

let time: NodeJS.Timeout;
let route: IObjectKeys | null;
const closeModal = inject("onModalClose", () => () => {});
const blacklist = ref<string[]>([]);
const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});

const balances = computed(() => {
  const assets = wallet.balances
    .map((item) => {
      const currency = { ...AssetUtils.getCurrencyByDenom(item.balance.denom), balance: item.balance };
      return currency;
    })
    .filter((item) => {
      return !blacklist.value.includes(item.ibcData);
    });
  return assets;
});

const state = ref({
  selectedCurrency: null as ExternalCurrency | null,
  swapToSelectedCurrency: null as ExternalCurrency | null,
  amount: "",
  swapToAmount: "",
  receiverAddress: "",
  errorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.swap_amount, NATIVE_ASSET.denom),
  loading: false,
  disabled: false,
  disableForm: false,
  swapFee: ""
});

onMounted(async () => {
  try {
    const config = await AppUtils.getSkipRouteConfig();
    blacklist.value = config.blacklist;
    state.value.selectedCurrency = balances.value.find((item) => item.ibcData == config.swap_currency)!;
    state.value.swapToSelectedCurrency = balances.value.find((item) => item.ibcData == config.swap_to_currency)!;
    setSwapFee();
    nextTick(() => {
      state.value.errorMsg = "";
    });
  } catch (error) {
    Logger.error(error);
  }
});

function onReset() {
  showConfirmScreen.value = false;
  state.value.amount = "";
  state.value.swapToAmount = "";
  nextTick(() => {
    state.value.errorMsg = "";
  });
  setShowDialogHeader(true);
  step.value = CONFIRM_STEP.CONFIRM;
  route = null;
}

function updateAmount(value: string) {
  state.value.amount = value;
  updateRoute();
}

async function setRoute(token: Coin, revert = false) {
  if (state.value.selectedCurrency && state.value.swapToSelectedCurrency) {
    clearTimeout(time);

    time = setTimeout(async () => {
      try {
        state.value.loading = true;
        if (revert) {
          route = await SkipRouter.getRoute(
            state.value.selectedCurrency!.ibcData,
            state.value.swapToSelectedCurrency!.ibcData,
            token.amount.toString(),
            revert
          );
          state.value.amount = new Dec(route.amountIn, state.value.selectedCurrency!.decimal_digits).toString(
            state.value.selectedCurrency!.decimal_digits
          );
        } else {
          route = await SkipRouter.getRoute(
            state.value.selectedCurrency!.ibcData,
            state.value.swapToSelectedCurrency!.ibcData,
            token.amount.toString(),
            revert
          );

          state.value.swapToAmount = new Dec(
            route.amountOut,
            state.value.swapToSelectedCurrency!.decimal_digits
          ).toString(state.value.swapToSelectedCurrency!.decimal_digits);
        }
        setSwapFee();
        state.value.disableForm = false;
      } catch (e) {
        route = null;
        state.value.disableForm = true;
        Logger.error(e);
        state.value.errorMsg = (e as Error).toString();
      } finally {
        state.value.loading = false;
      }
    }, timeOut);
  }
}

function updateSwapToAmount(value: string) {
  state.value.swapToAmount = value;

  const token = CurrencyUtils.convertDenomToMinimalDenom(
    state.value.swapToAmount,
    state.value.swapToSelectedCurrency!.ibcData,
    state.value.swapToSelectedCurrency!.decimal_digits
  );
  if (token.amount.gt(new Int(0))) {
    setRoute(token, true);
  }
}

function updateSelected(value: ExternalCurrency) {
  state.value.selectedCurrency = value;
  updateRoute();
  checkError();
}

function updateSwapToSelected(value: ExternalCurrency) {
  state.value.swapToSelectedCurrency = value;
  updateRoute();
  checkError();
}

function updateRoute() {
  const token = CurrencyUtils.convertDenomToMinimalDenom(
    state.value.amount,
    state.value.selectedCurrency!.ibcData,
    state.value.selectedCurrency!.decimal_digits
  );
  if (token.amount.gt(new Int(0))) {
    setRoute(token, false);
  }
}

function onSwapClick() {
  validateInputs();

  if (!state.value.errorMsg && WalletUtils.isAuth() && route) {
    showConfirmScreen.value = true;
  }
}

function validateInputs() {
  state.value.errorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency!.balance.denom,
    Number(state.value.selectedCurrency!.balance.amount)
  );

  if (state.value.selectedCurrency!.balance.denom === state.value.swapToSelectedCurrency!.balance.denom) {
    state.value.errorMsg = i18n.t("message.swap-same-error");
  }
}

watch(
  () => [state.value.amount, state.value.selectedCurrency, state.value.swapToSelectedCurrency],
  () => {
    validateInputs();
  }
);

async function onSwap() {
  if (!WalletUtils.isAuth() || !route) {
    return false;
  }

  try {
    step.value = CONFIRM_STEP.PENDING;

    await walletOperation(async () => {
      try {
        state.value.loading = true;
        state.value.disabled = true;
        const addresses = await getAddresses();
        await SkipRouter.submitRoute(route!, addresses);
        await wallet.UPDATE_BALANCES();
        step.value = CONFIRM_STEP.SUCCESS;
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        state.value.errorMsg = (error as Error).toString();
        Logger.error(error);
      } finally {
        state.value.loading = false;
        state.value.disabled = false;
      }
    });
  } catch (e) {
    Logger.error(e);
  }
}

async function getAddresses() {
  const native = wallet.wallet.signer.chainId;
  const nolusAddress = wallet.wallet.address;

  const addrs = {
    [native]: nolusAddress
  };
  const chainToParse: { [key: string]: IObjectKeys } = {};
  const chains = (await SkipRouter.getChains()).filter((item) => {
    if (item.chainID == native) {
      return false;
    }
    return route!.chainIDs.includes(item.chainID);
  });

  for (const chain of chains) {
    for (const key in SUPPORTED_NETWORKS_DATA) {
      if (SUPPORTED_NETWORKS_DATA[key].value == chain.chainName) {
        chainToParse[key] = SUPPORTED_NETWORKS_DATA[key];
      }
    }
  }
  const promises = [];

  for (const chain in chainToParse) {
    const fn = async function () {
      const client = await WalletUtils.getWallet(chain);
      const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
      const networkData = network?.supportedNetworks[chain];
      const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
      addrs[baseWallet.getSigner().chainId] = baseWallet.address;
    };
    promises.push(fn());
  }

  await Promise.all(promises);

  return addrs;
}

function onChangeFields() {
  const selected = state.value.selectedCurrency;
  const swapToSelectedCurrency = state.value.swapToSelectedCurrency;
  state.value.selectedCurrency = swapToSelectedCurrency;
  state.value.swapToSelectedCurrency = selected;
  checkError();
  updateRoute();
}

function checkError() {
  if (state.value.amount.length == 0) {
    nextTick(() => {
      state.value.errorMsg = "";
    });
  }
}

async function setSwapFee() {
  const amount = state.value.swapToAmount;
  const asset = state.value.swapToSelectedCurrency;

  if (asset) {
    const config = await AppUtils.getSkipRouteConfig();
    const amountString = amount.length > 0 ? amount : "0";
    const fee = new Dec(config.fee).quo(new Dec(1000)).mul(new Dec(amountString, asset.decimal_digits));
    const coin = CurrencyUtils.convertDenomToMinimalDenom(fee.toString(), asset.ibcData, asset.decimal_digits);

    state.value.swapFee = CurrencyUtils.convertMinimalDenomToDenom(
      coin.amount.toString(),
      asset.ibcData,
      asset.shortName,
      asset.decimal_digits
    )
      .trim(true)
      .toString();
  }
}

function onSendClick() {
  onSwap();
}
</script>
