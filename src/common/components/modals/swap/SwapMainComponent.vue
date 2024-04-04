<template>
  <SwapFormComponent
    :selectedCurrency="state.selectedCurrency"
    :swapToSelectedCurrency="state.swapToSelectedCurrency"
    :currentBalance="state.currentBalance"
    :amount="state.amount"
    :swapToAmount="state.swapToAmount"
    :errorMsg="state.errorMsg"
    :loading="state.loading"
    :onSwapClick="onSwapClick"
    @updateSelected="updateSelected"
    @updateAmount="updateAmount"
    @updateSwapToSelected="updateSwapToSelected"
    @updateSwapToAmount="updateSwapToAmount"
  />
</template>

<script lang="ts" setup>
import type { ExternalCurrency } from "@/common/types";
import { Dec, type Coin } from "@keplr-wallet/unit";
import type { RouteResponse } from "@skip-router/core";
import SwapFormComponent from "./SwapFormComponent.vue";

import { computed, inject, ref, watch } from "vue";
import { Logger, SkipRouter, WalletUtils, validateAmount, walletOperation } from "@/common/utils";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { useWalletStore } from "@/common/stores/wallet";
import { GAS_FEES, NATIVE_ASSET } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { SWAP_CURRENCIE } from "@/config/currencies";
import { CurrencyUtils } from "@nolus/nolusjs";

const wallet = useWalletStore();
const app = useApplicationStore();
const i18n = useI18n();
const timeOut = 600;

let time: NodeJS.Timeout;
let route: RouteResponse;
const closeModal = inject("onModalClose", () => () => {});

const balances = computed(() => {
  const assets = [];

  for (const key in app.currenciesData ?? {}) {
    const currency = app.currenciesData![key];
    const c = { ...currency };
    const item = wallet.balances.find((item) => item.balance.denom == currency.ibcData);

    if (item) {
      c.balance = item!.balance;
      assets.push(c);
    }
  }

  return assets;
});

const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value.find((item) => item.ticker == SWAP_CURRENCIE)!,
  swapToSelectedCurrency: balances.value.find((item) => item.ticker == NATIVE_ASSET.ticker)!,
  amount: "",
  swapToAmount: "",
  receiverAddress: "",
  errorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.swap_amount, NATIVE_ASSET.denom),
  loading: false
});

function updateAmount(value: string) {
  state.value.amount = value;
  updateRoute();
}

async function setRoute(token: Coin, revert = false) {
  clearTimeout(time);
  state.value.loading = true;

  time = setTimeout(async () => {
    try {
      if (revert) {
        route = await Skiproute.getRoute(
          state.value.selectedCurrency.ibcData,
          state.value.swapToSelectedCurrency.ibcData,
          token.amount.toString(),
          revert
        );

        state.value.amount = new Dec(route.amountIn, state.value.selectedCurrency.decimal_digits).toString(
          state.value.selectedCurrency.decimal_digits
        );
      } else {
        route = await SkipRouter.getRoute(
          state.value.selectedCurrency.ibcData,
          state.value.swapToSelectedCurrency.ibcData,
          token.amount.toString(),
          revert
        );

        state.value.swapToAmount = new Dec(route.amountOut, state.value.swapToSelectedCurrency.decimal_digits).toString(
          state.value.swapToSelectedCurrency.decimal_digits
        );
      }
    } catch (e) {
      Logger.error(e);
      state.value.errorMsg = (e as Error).toString();
    } finally {
      state.value.loading = false;
    }
  }, timeOut);
}

function updateSwapToAmount(value: string) {
  state.value.swapToAmount = value;
  const token = CurrencyUtils.convertDenomToMinimalDenom(
    state.value.swapToAmount,
    state.value.swapToSelectedCurrency.ibcData,
    state.value.swapToSelectedCurrency.decimal_digits
  );
  setRoute(token, true);
}

function updateSelected(value: ExternalCurrency) {
  state.value.selectedCurrency = value;
  updateRoute();
}

function updateSwapToSelected(value: ExternalCurrency) {
  state.value.swapToSelectedCurrency = value;
  updateRoute();
}

function updateRoute() {
  const token = CurrencyUtils.convertDenomToMinimalDenom(
    state.value.amount,
    state.value.selectedCurrency.ibcData,
    state.value.selectedCurrency.decimal_digits
  );
  setRoute(token, false);
}

function onSwapClick() {
  validateInputs();

  if (!state.value.errorMsg) {
    onSwap();
  }
}

function validateInputs() {
  state.value.errorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );

  if (state.value.selectedCurrency.balance.denom === state.value.swapToSelectedCurrency.balance.denom) {
    state.value.errorMsg = i18n.t("message.swap-same-error");
  }
}

watch(
  () => [state.value.amount, state.value.selectedCurrency],
  () => {
    validateInputs();
  }
);

async function onSwap() {
  if (!WalletUtils.isAuth()) {
    return false;
  }

  await walletOperation(async () => {
    SkipRouter.submitRoute(route, {
      "pirin-1": "nolus1ncc58ptqrkd7r7uk60dx4eufvvqf2edhtktv0q",
      "osmosis-1": "osmo1ncc58ptqrkd7r7uk60dx4eufvvqf2edh4agrmh"
    });
  });
}
</script>
