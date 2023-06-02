<template>
  <ConfirmExternalComponent
    v-if="showConfirmScreen"
    :selectedCurrency="selectedCurrency!"
    :receiverAddress="wallet"
    :password="password"
    :amount="amount"
    :memo="memo"
    :txType="TxType.SEND"
    :txHash="txHash"
    :step="step"
    :fee="fee"
    :networkCurrencies="networkCurrenciesObject"
    :networkKey="selectedNetwork.key"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => (password = value)"
  />
  <template v-else>
    <div
      class="modal-send-receive-input-area overflow-auto custom-scroll"
      v-if="selectedNetwork.native"
    >
      <div class="block text-left">

        <div class="block mt-[25px]">
          <Picker
            :default-option="networks[0]"
            :options="networks"
            :label="$t('message.network')"
            @update-selected="onUpdateNetwork"
          />
        </div>

        <div class="block mt-[18px]">
          <p class="text-14 nls-font-500 text-primary m-0 mb-[6px]">
            {{ $t("message.address") }}
          </p>
          <p class="text-14 text-primary nls-font-700 m-0 break-all">
            {{ wallet }}
          </p>
          <div class="flex items-center justify-start mt-2">
            <button
              class="btn btn-secondary btn-medium-secondary btn-icon mr-2 flex"
              @click="
                modelValue?.onCopyClick(wallet);
              onCopy();
              "
            >
              <DocumentDuplicateIcon class="icon w-4 h-4" />
              {{ copyText }}
            </button>
            <button
              class="btn btn-secondary btn-medium-secondary btn-icon flex"
              @click="modelValue?.onScanClick"
            >
              <QrCodeIcon class="icon w-4 h-4" />
              {{ $t("message.show-barcode") }}
            </button>
          </div>
        </div>

        <div class="flex justify-between w-full text-light-blue text-[14px] mt-4">
          <p>{{ $t("message.estimate-time") }}:</p>
          <p>~{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
        </div>
      </div>
    </div>
    <template v-else>
      <form
        @submit.prevent="receive"
        class="modal-form overflow-auto"
      >
        <!-- Input Area -->
        <div class="modal-send-receive-input-area background">

          <div class="block text-left">

            <div class="block mt-[20px]">
              <Picker
                :default-option="selectedNetwork"
                :options="networks"
                :label="$t('message.network')"
                :value="selectedNetwork"
                @update-selected="onUpdateNetwork"
              />
            </div>

            <div class="block mt-[20px]">
              <CurrencyField
                id="amount"
                :currency-options="networkCurrencies"
                :disabled-currency-picker="disablePicker"
                :is-loading-picker="disablePicker"
                :error-msg="amountErrorMsg"
                :is-error="amountErrorMsg !== ''"
                :option="selectedCurrency"
                :value="amount"
                :name="$t('message.amount')"
                :label="$t('message.amount-receive')"
                :set-input-value="setAmount"
                @update-currency="(event: AssetBalance) => (selectedCurrency = event)"
                @input="handleAmountChange($event)"
                :balance="formatCurrentBalance(selectedCurrency)"
              />
            </div>

            <div>
              <p class="text-14 nls-font-500 text-primary m-0 mb-[6px] mt-4">
                {{ $t("message.recipient") }}
              </p>
              <p class="text-14 text-primary nls-font-700 m-0 break-all">
                {{ wallet }}
              </p>
            </div>

          </div>
        </div>
        <!-- Actions -->
        <div class="modal-send-receive-actions background flex-col">
          <button
            class="btn btn-primary btn-large-primary plausible-event-name=receive"
            :class="{ 'js-loading': isLoading }"
          >
            {{ $t("message.receive") }}
          </button>
          <div class="flex justify-between w-full text-light-blue text-[14px] my-2">
            <p>{{ $t("message.estimate-time") }}:</p>
            <p>~{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
          </div>
        </div>
      </form>
    </template>
  </template>
</template>

<script setup lang="ts">
import Picker from "@/components/Picker.vue";
import CurrencyField from "@/components/CurrencyField.vue";
import ConfirmExternalComponent from "@/components/modals/templates/ConfirmExternalComponent.vue";

import type { AssetBalance } from "@/stores/wallet/state";
import { CONFIRM_STEP, TxType, type Network } from "@/types";

import { onUnmounted, ref, type PropType, computed, inject, watch } from "vue";
import { DocumentDuplicateIcon, QrCodeIcon } from "@heroicons/vue/24/solid";
import { NATIVE_NETWORK, SOURCE_PORTS } from "@/config/env";
import { useI18n } from "vue-i18n";
import { AssetUtils, EnvNetworkUtils, WalletUtils } from "@/utils";
import { NETWORKS_DATA, SUPPORTED_NETWORKS } from "@/networks/config";
import { NETWORKS_CURRENCIES, Wallet, BaseWallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import { externalWalletOperation } from "../utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { storeToRefs } from "pinia";

export interface ReceiveComponentProps {
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  onScanClick: () => void;
  onCopyClick: (wallet?: string) => void;
}

let timeOut: NodeJS.Timeout;
let client: Wallet;

const networks = SUPPORTED_NETWORKS;
const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const selectedNetwork = ref(SUPPORTED_NETWORKS[0]);
const walletStore = useWalletStore();

const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const amount = ref("");
const amountErrorMsg = ref("");
const disablePicker = ref(false);
const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const password = ref('');
const memo = ref('');
const txHash = ref('');
const fee = ref<Coin>()
const isLoading = ref(false);
const closeModal = inject("onModalClose", () => () => { });
const networkCurrenciesObject = ref();
const walletRef = storeToRefs(walletStore);
const wallet = ref(WalletUtils.transformWallet(NATIVE_NETWORK.prefix));

defineProps({
  modelValue: {
    type: Object as PropType<ReceiveComponentProps>,
  },
});

onUnmounted(() => {
  clearTimeout(timeOut);
  if (client) {
    client.destroy();
  }
});


watch(() => walletRef.wallet.value?.address, () => {
  wallet.value = WalletUtils.transformWallet(NATIVE_NETWORK.prefix);
});

const onUpdateNetwork = async (event: Network) => {
  selectedNetwork.value = event;
  networkCurrencies.value = [];
  if (!event.native) {

    if (client) {
      client.destroy();
    }

    disablePicker.value = true;

    client = await Wallet.getInstance(
      NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].supportedNetworks[event.key].tendermintRpc
    );

    const assets = await NETWORKS_CURRENCIES[event.prefix as keyof typeof NETWORKS_CURRENCIES]();
    const currenciesPromise = [];

    networkCurrenciesObject.value = assets;

    for (const key in assets) {

      const fn = async () => {
        const ibc_route = AssetUtils.makeIBCMinimalDenom(assets[key].ibc_route, assets[key].symbol);
        const balance = await client.getBalance('osmo17snxq7sdny468jc7kyxc2m4pzqvzpnv0zn4qeg', ibc_route);

        return {
          balance,
          name: assets[key].ticker,
          icon: assets[key].icon,
          ticker: assets[key].ticker,
          ibc_route: assets[key].ibc_route,
          decimals: Number(assets[key].decimal_digits),
          symbol: assets[key].symbol,
          native: assets[key].native
        };
      }

      currenciesPromise.push(fn());

    }

    const items = await Promise.all(currenciesPromise);
    selectedCurrency.value = items?.[0]
    networkCurrencies.value = items;
    disablePicker.value = false;

  } else {
    selectedCurrency.value = walletStore.balances[0];
  }
};

const onCopy = () => {
  copyText.value = i18n.t("message.copied");
  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    copyText.value = i18n.t("message.copy");
  }, 2000);
};

const receive = () => {
  validateInputs();
}

const handleAmountChange = (event: string) => {
  amount.value = event;
}

const validateInputs = async () => {

  try {
    isLoading.value = true;
    const isValid = await validateAmount();
    if (isValid) {
      const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
      const ibc_route = selectedCurrency.value?.ibc_route;
      const symbol = selectedCurrency.value?.symbol;

      if (ibc_route && symbol) {
        fee.value = coin(network.fees.transfer_amount, AssetUtils.makeIBCMinimalDenom(ibc_route, symbol))
        showConfirmScreen.value = true;
      }

    }
  } catch (error) {
    step.value = CONFIRM_STEP.ERROR;
    showConfirmScreen.value = true;
  } finally {
    isLoading.value = false;
  }

}

const validateAmount = async () => {

  amountErrorMsg.value = '';

  if (!amount.value) {
    amountErrorMsg.value = i18n.t("message.invalid-amount");
    return false;
  }

  const prefix = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key]?.prefix;
  const ibc_route = selectedCurrency.value?.ibc_route;
  const symbol = selectedCurrency.value?.symbol;
  const decimals = selectedCurrency.value?.decimals;

  if (prefix && ibc_route && symbol && decimals) {
    const balance = await client.getBalance(WalletUtils.transformWallet(prefix), AssetUtils.makeIBCMinimalDenom(ibc_route, symbol));
    const walletBalance = Decimal.fromAtomics(balance.amount, decimals);
    const transferAmount = Decimal.fromUserInput(
      amount.value,
      decimals
    );

    const isGreaterThanWalletBalance = transferAmount.isGreaterThan(walletBalance);

    if (isGreaterThanWalletBalance) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-big");
      return false;
    }


  } else {
    amountErrorMsg.value = i18n.t("message.unexpected-error");
    return false;
  }

  return true;
};


const onSendClick = async () => {
  try {
    const networkData = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
    await externalWalletOperation(
      ibcTransfer,
      client,
      networkData,
      password.value
    );
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
};

const ibcTransfer = async (baseWallet: BaseWallet) => {
  try {

    step.value = CONFIRM_STEP.PENDING;

    const networkData = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
    const denom = AssetUtils.makeIBCMinimalDenom(selectedCurrency.value?.ibc_route!, selectedCurrency.value?.symbol!);

    const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
      amount.value,
      denom,
      selectedCurrency.value?.decimals!
    );

    const funds: Coin = {
      amount: minimalDenom.amount.toString(),
      denom,
    };

    const { txHash: txHashData, txBytes, usedFee } = await baseWallet.simulateSendIbcTokensTx({
      toAddress: wallet.value,
      amount: funds,
      sourcePort: SOURCE_PORTS.TRANSFER,
      sourceChannel: networkData.sourceChannel,
      gasMuplttiplier: networkData.gasMuplttiplier,
      gasPrice: networkData.gasPrice,
      timeOut: networkData.ibcTransferTimeout,
      memo: memo.value,
    });

    txHash.value = txHashData;

    if (usedFee?.amount?.[0]) {
      fee.value = usedFee.amount[0];
    }

    const tx = await baseWallet.broadcastTx(txBytes as Uint8Array);
    const isSuccessful = tx?.code === 0;
    step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
    baseWallet.disconnect();

    setTimeout(async () => {
      await walletStore[WalletActionTypes.UPDATE_BALANCES]();
    }, 6000);

  } catch (error) {
    console.log(error)
    step.value = CONFIRM_STEP.ERROR;
  }
}

const onConfirmBackClick = () => {
  showConfirmScreen.value = false;
};

const onClickOkBtn = () => {
  closeModal();
};

const formatCurrentBalance = (selectedCurrency: AssetBalance | undefined) => {

  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {

    if (selectedNetwork.value.native) {
      const asset = walletStore.getCurrencyInfo(
        selectedCurrency.balance.denom
      );
      return CurrencyUtils.convertMinimalDenomToDenom(
        selectedCurrency.balance.amount.toString(),
        selectedCurrency.balance.denom,
        asset.coinDenom,
        asset.coinDecimals
      ).toString();
    } else {

      if (selectedCurrency.decimals != null && selectedCurrency.name != null) {

        return CurrencyUtils.convertMinimalDenomToDenom(
          selectedCurrency.balance.amount.toString(),
          selectedCurrency.balance.denom,
          selectedCurrency.name as string,
          selectedCurrency.decimals as number
        ).toString();
      }

    }

  }
};

const setAmount = (p: number) => {
  const asset = AssetUtils.getAssetInfo(
    selectedCurrency.value.ticker as string
  );
  const percent = new Dec(p).quo(new Dec(100));
  const data = CurrencyUtils.convertMinimalDenomToDenom(selectedCurrency.value.balance.amount, asset.coinMinimalDenom, asset.coinDenom, asset.coinDecimals).toDec();
  const value = data.mul(percent);
  amount.value = value.toString(asset.coinDecimals);
};
</script>
