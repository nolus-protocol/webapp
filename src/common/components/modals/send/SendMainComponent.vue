<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :amount="state.amount"
    :memo="state.memo"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
  />
  <SendComponent
    v-else
    v-model="state"
    class="custom-scroll overflow-auto"
  />
</template>

<script lang="ts" setup>
import type { SendComponentProps } from "./types/SendComponentProps";
import { type Networks } from "@nolus/nolusjs/build/types/Networks";

import SendComponent from "./SendComponent.vue";
import ConfirmComponent from "../templates/ConfirmComponent.vue";

import { CONFIRM_STEP, TxType } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { coin, type Coin } from "@cosmjs/amino";
import { CurrencyUtils } from "@nolus/nolusjs";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";

import {
  NATIVE_ASSET,
  GAS_FEES,
  NATIVE_NETWORK,
  ErrorCodes,
  IGNORE_TRANSFER_ASSETS,
  LPN_NETWORK
} from "@/config/global";

import {
  Logger,
  externalWallet,
  transferCurrency,
  validateAddress,
  validateAmount,
  walletOperation
} from "@/common/utils";
import { AssetUtils, EnvNetworkUtils, WalletUtils } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";

import type { AssetBalance } from "@/common/stores/wallet/types";
import type { BaseWallet, Wallet } from "@/networks";
import { AppUtils } from "@/common/utils";
import { CurrencyDemapping, SOURCE_PORTS } from "@/config/currencies";

const step = ref(CONFIRM_STEP.CONFIRM);
const walletStore = useWalletStore();
const app = useApplicationStore();
let client: Wallet;

const closeModal = inject("onModalClose", () => () => {});

const props = defineProps({
  dialogSelectedCurrency: {
    type: String,
    default: ""
  }
});

const balances = ref<AssetBalance[]>(
  walletStore.balances
    .filter((item) => {
      const currency = walletStore.getCurrencyInfo(item.balance.denom);
      if (IGNORE_TRANSFER_ASSETS.includes(currency.ticker as string)) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const e = { ...item };
      if (e.balance.denom == walletStore.available.denom) {
        e.balance = { ...walletStore.available };
      }
      return e;
    })
);

const networks = computed(() => {
  return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list;
});

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value[0],
  dialogSelectedCurrency: props.dialogSelectedCurrency,
  amount: "",
  memo: "",
  network: networks.value[0],
  receiverAddress: "",
  onNextClick,
  receiverErrorMsg: "",
  amountErrorMsg: "",
  fee: coin(GAS_FEES.transfer_amount, NATIVE_ASSET.denom),
  txHash: ""
} as SendComponentProps);

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  closeModal();
}

onMounted(() => {
  if ((state.value.dialogSelectedCurrency.length as number) > 0) {
    const currency = balances.value.find((e) => {
      const asset = AssetUtils.getAssetInfoByDenom(e.balance.denom);
      return asset.key == props.dialogSelectedCurrency;
    })!;
    state.value.selectedCurrency = currency;
    nextTick(() => {
      state.value.amountErrorMsg = "";
    });
  }
});

onUnmounted(() => {
  if (client) {
    client.destroy();
  }
});

watch(
  () => [state.value.selectedCurrency, state.value.amount],
  () => {
    state.value.amountErrorMsg = validateAmount(
      state.value.amount,
      state.value.selectedCurrency.balance.denom,
      state.value.selectedCurrency.balance.amount
    );
  }
);

watch(
  () => state.value.receiverAddress,
  () => {
    state.value.receiverErrorMsg = validateAddress(state.value.receiverAddress);
  }
);

watch(
  () => state.value.network,
  async () => {
    const currencies = Object.keys(app.networks?.[state.value.network.key] ?? {});
    const native = app.networks![NATIVE_NETWORK.key];
    const items: string[] = [];

    for (let c of currencies) {
      if (CurrencyDemapping[c]) {
        currencies.push(CurrencyDemapping[c].ticker);
      }
    }

    if (state.value.network.key == NATIVE_NETWORK.key) {
      for (const i in native) {
        const c = native[i];
        if (currencies.includes(c.key!)) {
          const [ckey, protocol = AppUtils.getProtocols().osmosis]: string[] = c.key!.split("@");
          const ibc = NolusAssetUtils.makeIBCMinimalDenom(
            ckey,
            app.networksData!,
            NATIVE_NETWORK.key as Networks,
            app.networksData?.protocols[protocol].DexNetwork as string
          );
          items.push(ibc);
        }
      }
    } else {
      for (const i in native) {
        const c = native[i];
        let [ticker, protocol] = c.key!.split("@");

        let lpn = app.lpn?.find((item) => {
          return item.key == c.key;
        });

        if (lpn && !LPN_NETWORK.includes(state.value.network.key)) {
          if (app.networksData?.protocols[protocol].DexNetwork == state.value.network.key) {
            const ibc = NolusAssetUtils.makeIBCMinimalDenom(
              ticker,
              app.networksData!,
              NATIVE_NETWORK.key as Networks,
              app.networksData?.protocols[protocol].DexNetwork as string
            );
            items.push(ibc);
          }
          continue;
        }

        if (currencies.includes(ticker)) {
          const [ckey, protocol = AppUtils.getProtocols().osmosis]: string[] = c.key!.split("@");
          const ibc = NolusAssetUtils.makeIBCMinimalDenom(
            ckey,
            app.networksData!,
            NATIVE_NETWORK.key as Networks,
            app.networksData?.protocols[protocol].DexNetwork as string
          );
          items.push(ibc);
        }
      }
    }

    state.value.currentBalance = walletStore.balances
      .filter((item) => {
        const currency = walletStore.currencies[item.balance.denom];
        if (IGNORE_TRANSFER_ASSETS.includes(currency.ticker as string)) {
          return false;
        }

        if (items.includes(item.balance.denom)) {
          return true;
        }
        return false;
      })
      .map((item) => {
        const e = { ...item };
        if (e.balance.denom == walletStore.available.denom) {
          e.balance = { ...walletStore.available };
        }
        return e;
      });

    if ((props.dialogSelectedCurrency.length as number) == 0) {
      state.value.selectedCurrency = state.value.currentBalance[0];
    }

    setWallet();

    nextTick(() => {
      state.value.receiverErrorMsg = "";
      state.value.amountErrorMsg = "";
    });
  }
);

async function setWallet() {
  if (!state.value.network.native) {
    client = await WalletUtils.getWallet(state.value.network.key);
    const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
    const networkData = network?.supportedNetworks[state.value.network.key];
    const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
    state.value.wallet = baseWallet.address;
    state.value.receiverAddress = baseWallet.address as string;
  } else {
    state.value.wallet = undefined;
    state.value.receiverAddress = "";
  }
}

function validateInputs() {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    state.value.selectedCurrency.balance.amount
  );
  const networkInfo = SUPPORTED_NETWORKS_DATA[state.value.network.key as keyof typeof SUPPORTED_NETWORKS_DATA];
  if (networkInfo.forward) {
    const proxyAddress = state.value.wallet as string;
    state.value.receiverErrorMsg = validateAddress(proxyAddress);
    return;
  }

  state.value.receiverErrorMsg = validateAddress(state.value.receiverAddress);
}

async function onSendClick() {
  try {
    await walletOperation(state.value.network.native ? transferAmount : ibcTransfer);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function transferAmount() {
  step.value = CONFIRM_STEP.PENDING;

  const { success, txHash, txBytes, usedFee } = await transferCurrency(
    state.value.selectedCurrency.balance.denom,
    state.value.amount,
    state.value.receiverAddress,
    state.value.memo
  );

  if (success) {
    state.value.txHash = txHash;

    if (usedFee?.amount?.[0]) {
      state.value.fee = usedFee.amount[0];
    }

    try {
      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      await walletStore.UPDATE_BALANCES();
    } catch (error: Error | any) {
      switch (error.code) {
        case ErrorCodes.GasError: {
          step.value = CONFIRM_STEP.GasError;
          break;
        }
        default: {
          step.value = CONFIRM_STEP.ERROR;
          break;
        }
      }
    }
  } else {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function ibcTransfer() {
  try {
    const wallet = walletStore.wallet;
    const denom = state.value.selectedCurrency.balance.denom;

    if (wallet) {
      step.value = CONFIRM_STEP.PENDING;
      const { coinMinimalDenom, coinDecimals } = walletStore.getCurrencyInfo(
        state.value.selectedCurrency.balance.denom
      );

      const currency = walletStore.currencies[state.value.selectedCurrency.balance.denom];
      const [key, protocol] = currency.ticker.split("@");
      const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(state.value.amount, coinMinimalDenom, coinDecimals);

      const funds: Coin = {
        amount: minimalDenom.amount.toString(),
        denom
      };

      const networkInfo = SUPPORTED_NETWORKS_DATA[state.value.network.key as keyof typeof SUPPORTED_NETWORKS_DATA];

      const sourceChannel = networkInfo.forward
        ? AssetUtils.getSourceChannel(
            app.networksData?.networks?.channels!,
            app.networksData?.protocols[protocol].DexNetwork!,
            NATIVE_NETWORK.key
          )
        : AssetUtils.getSourceChannel(
            app.networksData?.networks?.channels!,
            state.value.network.key,
            NATIVE_NETWORK.key
          );

      const rawTx: {
        toAddress: string;
        amount: Coin;
        sourcePort: string;
        sourceChannel: string;
        memo?: string;
      } = {
        toAddress: "",
        amount: funds,
        sourcePort: SOURCE_PORTS.TRANSFER,
        sourceChannel: sourceChannel as string
      };

      if (networkInfo.forward) {
        const channel = AssetUtils.getChannelDataByProtocol(
          app.networksData?.networks?.channels!,
          app.networksData?.protocols[protocol].DexNetwork!,
          state.value.network.key
        );

        const proxyAddress = walletStore.wallet?.address as string;

        rawTx.toAddress = proxyAddress;
        rawTx.memo = JSON.stringify({
          forward: {
            receiver: state.value.receiverAddress,
            port: SOURCE_PORTS.TRANSFER,
            channel: channel!.a.ch
          }
        });
      } else {
        rawTx.toAddress = state.value.receiverAddress;
      }

      const { txHash, txBytes, usedFee } = await wallet.simulateSendIbcTokensTx(rawTx);

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
    }
    await walletStore.UPDATE_BALANCES();
  } catch (error: Error | any) {
    console.log(error);
    switch (error.code) {
      case ErrorCodes.GasError: {
        step.value = CONFIRM_STEP.GasError;
        break;
      }
      default: {
        step.value = CONFIRM_STEP.ERROR;
        break;
      }
    }
    Logger.error(error);
  }
}

function onNextClick() {
  validateInputs();

  if (!state.value.amountErrorMsg && !state.value.receiverErrorMsg) {
    showConfirmScreen.value = true;
  }
}
</script>
