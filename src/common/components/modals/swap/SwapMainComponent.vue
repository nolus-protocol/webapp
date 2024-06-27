<template>
  <ConfirmSwapComponent
    v-if="showConfirmScreen"
    :txType="$t(`message.${TxType.SWAP}`) + ':'"
    :txHashes="txHashes"
    :step="step"
    :fee="state.fee"
    :errorMsg="params.data?.errorMsg ?? state.errorMsg"
    :txs="route!.txsRequired"
    :swap-amount="`${swapAmount}`"
    :for-amount="`${forAmount}`"
    :onSendClick="onSendClick"
    :onBackClick="onReset"
    :onOkClick="() => closeModal()"
    :from-network="SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key].label"
    :to-network="SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key].label"
    :from-address="wallet.wallet?.address"
    :receiver-address="wallet.wallet?.address"
    :warning="route?.warning?.message ?? ''"
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
import { BaseWallet } from "@/networks";
import SwapFormComponent from "./SwapFormComponent.vue";
import ConfirmSwapComponent from "../templates/ConfirmSwapComponent.vue";

import { computed, inject, onMounted, ref, watch, nextTick, type PropType, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { coin } from "@cosmjs/amino";
import { useWalletStore } from "@/common/stores/wallet";
import { GAS_FEES, NATIVE_ASSET, NATIVE_NETWORK } from "@/config/global";
import { CurrencyUtils } from "@nolus/nolusjs";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { SwapStatus } from "./types";

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
import { HYSTORY_ACTIONS } from "@/modules/history/types";

const wallet = useWalletStore();
const i18n = useI18n();
const timeOut = 600;

let time: NodeJS.Timeout;
let route: IObjectKeys | null;
const closeModal = inject("onModalClose", () => {});
const setDisable = inject("setDisable", (b: boolean) => {});

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
  fee: coin(GAS_FEES.swap_amount, NATIVE_ASSET.denom),
  loading: false,
  disabled: false,
  disableForm: false,
  swapFee: ""
});

const txHashes = ref<{ hash: string; status: SwapStatus }[]>([]);
let id = Date.now();
const params = defineProps({
  data: {
    type: Object as PropType<IObjectKeys | null>
  }
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
    setParams();
  } catch (error) {
    Logger.error(error);
  }
});

onUnmounted(() => {
  if (step.value == CONFIRM_STEP.PENDING && params.data == null) {
    const data = {
      id,
      route,
      selectedCurrency: state.value.selectedCurrency,
      swapToSelectedCurrency: state.value.swapToSelectedCurrency,
      amount: state.value.amount,
      swapToAmount: state.value.swapToAmount,
      txHashes: txHashes.value,
      step: step.value,
      fee: state.value.fee,
      fromAddress: wallet.wallet.address,
      action: HYSTORY_ACTIONS.SWAP,
      errorMsg: state.value.errorMsg,
      selectedNetwork: SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key]
    };
    wallet.updateHistory(data);
  }
});

watch(
  () => params.data,
  () => {
    setParams();
  },
  {
    deep: true
  }
);

function setParams() {
  if (params.data) {
    id = params.data.id;
    route = params.data.route;
    state.value.selectedCurrency = params.data.selectedCurrency;
    state.value.swapToSelectedCurrency = params.data.swapToSelectedCurrency;
    state.value.amount = params.data.amount;
    state.value.swapToAmount = params.data.swapToAmount;
    txHashes.value = params.data.txHashes;
    step.value = params.data.step;
    state.value.fee = params.data.fee;
    state.value.errorMsg = params.data.errorMsg;
    showConfirmScreen.value = true;
  }
}

function onReset() {
  showConfirmScreen.value = false;
  state.value.amount = "";
  state.value.swapToAmount = "";
  setDisable(false);
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
        const wallets = await getWallets();
        const addresses: Record<string, string> = {};

        for (const key in wallets) {
          addresses[key] = wallets[key].address!;
        }

        await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet) => {
          const element = {
            hash: tx.txHash,
            status: SwapStatus.pending
          };

          const index = txHashes.value.length;
          txHashes.value.push(element);

          await wallet.broadcastTx(tx.txBytes as Uint8Array);
          txHashes.value[index].status = SwapStatus.success;
        });

        await wallet.UPDATE_BALANCES();
        step.value = CONFIRM_STEP.SUCCESS;

        if (wallet.history[id]) {
          wallet.history[id].step = CONFIRM_STEP.SUCCESS;
        }
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        state.value.errorMsg = (error as Error).toString();
        Logger.error(error);

        if (wallet.history[id]) {
          wallet.history[id].step = CONFIRM_STEP.ERROR;
          wallet.history[id].errorMsg = state.value.errorMsg;
        }
      } finally {
        state.value.loading = false;
        state.value.disabled = false;
      }
    });
  } catch (e) {
    Logger.error(e);
  }
}

async function getWallets(): Promise<{ [key: string]: BaseWallet }> {
  const native = wallet.wallet.signer.chainId as string;
  const addrs = {
    [native]: wallet.wallet
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
      const chainId = await baseWallet.getChainId();
      addrs[chainId] = baseWallet;
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
    const fee = new Dec(config.fee).quo(new Dec(10000)).mul(new Dec(amountString, asset.decimal_digits));
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

const swapAmount = computed(() => {
  return `${new Dec(state.value.amount).toString(state.value.selectedCurrency?.decimal_digits)} ${state.value.selectedCurrency?.shortName}`;
});

const forAmount = computed(() => {
  return `${new Dec(state.value.swapToAmount).toString(state.value.swapToSelectedCurrency?.decimal_digits)} ${state.value.swapToSelectedCurrency?.shortName}`;
});

function onSendClick() {
  onSwap();
}
</script>
