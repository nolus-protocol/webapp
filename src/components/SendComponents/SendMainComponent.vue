<template>
  <ConfirmComponent
    v-if="showConfirmScreen"
    :selectedCurrency="state.selectedCurrency"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :memo="state.memo"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txHash="state.txHash"
    :step="step"
    :fee="state.fee"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (state.password = value)"
  />
  <SendComponent
    v-else
    v-model="state"
    class="overflow-auto custom-scroll"
  />
</template>

<script lang="ts" setup>
import type { SendComponentProps } from "@/types/component/SendComponentProps";

import SendComponent from "@/components/SendComponents/SendComponent.vue";
import ConfirmComponent from "@/components/modals/templates/ConfirmComponent.vue";

import { CONFIRM_STEP } from "@/types/ConfirmStep";
import { TxType } from "@/types/TxType";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";
import { computed, inject, nextTick, onUnmounted, ref, watch } from "vue";
import { coin, type Coin } from "@cosmjs/amino";
import { CurrencyUtils } from "@nolus/nolusjs";
import { NETWORKS_DATA } from "@/networks/config";

import {
  NATIVE_ASSET,
  GAS_FEES,
  SNACKBAR,
  SOURCE_PORTS,
  NATIVE_NETWORK,
  ErrorCodes
} from "@/config/env";

import {
  transferCurrency,
  validateAddress,
  validateAmount,
  walletOperation,
} from "@/components/utils";
import { AssetUtils, EnvNetworkUtils, WalletUtils } from "@/utils";
import { useApplicationStore } from "@/stores/application";
import type { AssetBalance } from "@/stores/wallet/state";

const step = ref(CONFIRM_STEP.CONFIRM);
const walletStore = useWalletStore();
const app = useApplicationStore();

const closeModal = inject("onModalClose", () => () => { });
const snackbarVisible = inject("snackbarVisible", () => false);

const showSnackbar = inject(
  "showSnackbar",
  (type: string, transaction: string) => { }
);
const balances = ref<AssetBalance[]>(walletStore.balances.map((item) => {
  const e = { ...item }
  if (e.balance.denom == walletStore.available.denom) {
    e.balance = { ...walletStore.available }
  }
  return e;
}));

const networks = computed(() => {
  return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list;
});

const showConfirmScreen = ref(false);
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value[0],
  amount: "",
  memo: "",
  network: networks.value[0],
  receiverAddress: "",
  password: "",
  onNextClick,
  receiverErrorMsg: "",
  amountErrorMsg: "",
  fee: coin(GAS_FEES.transfer_amount, NATIVE_ASSET.denom),
  txHash: "",
} as SendComponentProps);

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  closeModal();
};

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, state.value.txHash);
  }
});

watch(() => [state.value.selectedCurrency, state.value.amount], () => {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );
})

watch(() => state.value.receiverAddress, () => {
  state.value.receiverErrorMsg = validateAddress(state.value.receiverAddress);
})

watch(() => state.value.network, () => {
  const network = app.networksData!.networks.list[state.value.network.key];

  if (network?.forward) {
    const native = app.networks![NATIVE_NETWORK.key];
    const items: string[] = [];

    for (const i in native) {
      const c = native[i];
      if (c.forward?.includes(state.value.network.key)) {
        const ibc = AssetUtils.makeIBCMinimalDenom(c.ibc_route, c.symbol);
        items.push(ibc);
      }
    }
    state.value.currentBalance = walletStore.balances.filter((item) => {
      if (items.includes(item.balance.denom)) {
        return true;
      }
      return false;
    }).map((item) => {
      const e = { ...item }
      if (e.balance.denom == walletStore.available.denom) {
        e.balance = { ...walletStore.available }
      }
      return e;
    });

  } else {
    state.value.currentBalance = walletStore.balances.map((item) => {
      const e = { ...item }
      if (e.balance.denom == walletStore.available.denom) {
        e.balance = { ...walletStore.available }
      }
      return e;
    });
  }

  state.value.selectedCurrency = state.value.currentBalance[0];

  nextTick(() => {
    state.value.receiverErrorMsg = '';
    state.value.amountErrorMsg = '';
  });

})

const validateInputs = () => {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  );
  const networkInfo = app.networksData!.networks.list[state.value.network.key];
  if (networkInfo.forward) {
    const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
    const proxyAddress = WalletUtils.transformWallet(network.supportedNetworks[networkInfo.forward].prefix);
    state.value.receiverErrorMsg = validateAddress(proxyAddress);
    return;
  }

  state.value.receiverErrorMsg = validateAddress(state.value.receiverAddress);
};

const onSendClick = async () => {
  try {
    await walletOperation(
      state.value.network.native ? transferAmount : ibcTransfer,
      state.value.password
    );
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
};

const transferAmount = async () => {
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
      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }
      await walletStore[WalletActionTypes.UPDATE_BALANCES]();

    } catch (error: Error | any) {
      switch (error.code) {
        case (ErrorCodes.GasError): {
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
};

const ibcTransfer = async () => {
  try {
    const wallet = walletStore.wallet;
    const denom = state.value.selectedCurrency.balance.denom;
    if (wallet) {
      step.value = CONFIRM_STEP.PENDING;
      const { coinMinimalDenom, coinDecimals } = walletStore.getCurrencyInfo(
        state.value.selectedCurrency.balance.denom
      );

      const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
        state.value.amount,
        coinMinimalDenom,
        coinDecimals
      );

      const funds: Coin = {
        amount: minimalDenom.amount.toString(),
        denom,
      };


      const networkInfo = app.networksData!.networks.list[state.value.network.key];
      const sourceChannel = AssetUtils.getSourceChannel(app.networksData?.networks?.channels!, networkInfo.forward ?? state.value.network.key, NATIVE_NETWORK.key);

      const rawTx: {
        toAddress: string,
        amount: Coin,
        sourcePort: string,
        sourceChannel: string,
        memo?: string
      } = {
        toAddress: "",
        amount: funds,
        sourcePort: SOURCE_PORTS.TRANSFER,
        sourceChannel: sourceChannel as string,
      };

      if (networkInfo.forward) {
        const networkData = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
        const proxyAddress = WalletUtils.transformWallet(networkData.supportedNetworks[networkInfo.forward].prefix);
        const channel = AssetUtils.getSourceChannel(app.networksData?.networks?.channels!, state.value.network.key, networkInfo.forward!, networkInfo.forward!);

        rawTx.toAddress = proxyAddress;
        rawTx.memo = JSON.stringify({
          "forward": {
            "receiver": state.value.receiverAddress,
            "port": SOURCE_PORTS.TRANSFER,
            "channel": channel
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
      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }
    }
    await walletStore[WalletActionTypes.UPDATE_BALANCES]();
  } catch (error: Error | any) {
    switch (error.code) {
      case (ErrorCodes.GasError): {
        step.value = CONFIRM_STEP.GasError;
        break;
      }
      default: {
        step.value = CONFIRM_STEP.ERROR;
        break;
      }
    }
  };
}

function onNextClick() {
  validateInputs();

  if (!state.value.amountErrorMsg && !state.value.receiverErrorMsg) {
    showConfirmScreen.value = true;
  }
}
</script>
