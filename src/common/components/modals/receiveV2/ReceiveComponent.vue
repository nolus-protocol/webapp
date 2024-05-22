<template>
  <ConfirmExternalComponent
    v-if="showConfirmScreen"
    :network-type="NetworkTypes.cosmos"
    :selectedCurrency="selectedCurrency!"
    :receiverAddress="walletStore.wallet?.address as string"
    :amount="amount"
    :memo="memo"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txHash="txHash"
    :step="step"
    :fee="fee"
    :networkCurrencies="networkCurrenciesObject"
    :networkKey="selectedNetwork.key"
    :networkSymbol="selectedNetwork.symbol"
    :onSendClick="onSendClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
  />
  <template v-else>
    <div
      class="modal-send-receive-input-area custom-scroll overflow-auto"
      v-if="selectedNetwork.native"
    >
      <div class="block text-left">
        <div class="mt-[25px] block">
          <Picker
            :default-option="networks[0]"
            :options="networks"
            :label="$t('message.network')"
            @update-selected="onUpdateNetwork"
            :disable-input="true"
          />
        </div>

        <div class="mt-[18px] block">
          <p class="nls-font-500 m-0 mb-[6px] text-14 text-primary">
            {{ $t("message.address") }}
          </p>
          <p class="nls-font-700 m-0 break-all text-14 text-primary">
            {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t("message.connect-wallet-label") }}
          </p>
          <div class="mt-2 flex items-center justify-start">
            <button
              class="btn btn-secondary btn-medium-secondary btn-icon mr-2 flex"
              @click="onCopy()"
            >
              <DocumentDuplicateIcon class="icon h-4 w-4" />
              {{ copyText }}
            </button>
          </div>
        </div>

        <div class="mt-4 flex w-full justify-between text-[14px] text-light-blue">
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
            <div class="mt-[20px] block">
              <Picker
                :default-option="selectedNetwork"
                :options="networks"
                :label="$t('message.network')"
                :value="selectedNetwork"
                @update-selected="onUpdateNetwork"
                :disable-input="true"
              />
            </div>

            <div class="mt-[20px] block">
              <CurrencyField
                id="amount"
                :currency-options="networkCurrencies"
                :disabled-currency-picker="disablePicker || disablePickerDialog"
                :is-loading-picker="disablePicker"
                :error-msg="amountErrorMsg"
                :is-error="amountErrorMsg !== ''"
                :option="selectedCurrency"
                :value="amount"
                :name="$t('message.amount')"
                :label="$t('message.amount-receive')"
                :total="new KeplrCoin(selectedCurrency.balance.denom, selectedCurrency.balance.amount)"
                :balance="formatCurrentBalance(selectedCurrency)"
                @update-currency="(event: AssetBalance) => (selectedCurrency = event)"
                @input="handleAmountChange($event)"
              />
            </div>

            <div>
              <p class="nls-font-500 m-0 mb-[6px] mt-2 text-14 text-primary">
                {{ $t("message.recipient") }}
              </p>
              <p class="nls-font-700 m-0 break-all text-14 text-primary">
                {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t("message.connect-wallet-label") }}
              </p>
            </div>
          </div>
        </div>
        <!-- Actions -->
        <div class="modal-send-receive-actions background flex-col">
          <button
            class="btn btn-primary btn-large-primary"
            :class="{ 'js-loading': isLoading }"
          >
            {{ $t("message.receive") }}
          </button>
          <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
            <p>{{ $t("message.estimate-time") }}:</p>
            <p>~{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
          </div>
        </div>
      </form>
    </template>
  </template>
</template>

<script setup lang="ts">
import Picker from "@/common/components/Picker.vue";
import CurrencyField from "@/common/components/CurrencyField.vue";
import ConfirmExternalComponent from "@/common/components/modals/templates/ConfirmExternalComponent.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import { onUnmounted, ref, inject, watch, computed } from "vue";
import { DocumentDuplicateIcon } from "@heroicons/vue/24/solid";
import { useI18n } from "vue-i18n";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { Wallet, BaseWallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import { externalWalletOperation, externalWallet } from "@/common/utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Coin as KeplrCoin } from "@keplr-wallet/unit";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { Networks } from "@nolus/nolusjs/build/types/Networks";
import { AppUtils } from "@/common/utils";
import { CurrencyDemapping, CurrencyMapping, SOURCE_PORTS } from "@/config/currencies";
import { MetaMaskWallet } from "@/networks/metamask";
import { ErrorCodes, IGNORE_TRANSFER_ASSETS, LPN_NETWORK, NATIVE_NETWORK } from "@/config/global";

import {
  CONFIRM_STEP,
  TxType,
  type Network,
  NetworkTypes,
  type ExternalCurrency,
  type IObjectKeys
} from "@/common/types";

import {
  AssetUtils,
  EnvNetworkUtils,
  Logger,
  SkipRouter,
  StringUtils,
  WalletManager,
  WalletUtils
} from "@/common/utils";

export interface ReceiveComponentProps {
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  onCopyClick: (wallet?: string) => void;
}

let timeOut: NodeJS.Timeout;
let client: Wallet;

const walletStore = useWalletStore();
const app = useApplicationStore();

const networks = computed(() => {
  return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list;
});

const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const selectedNetwork = ref(networks.value[0]);

const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const amount = ref("");
const amountErrorMsg = ref("");
const disablePicker = ref(false);
const disablePickerDialog = ref(false);

const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const memo = ref("");
const txHash = ref("");
const fee = ref<Coin>();
const isLoading = ref(false);
const closeModal = inject("onModalClose", () => () => {});
const networkCurrenciesObject = ref();
const wallet = ref(walletStore.wallet?.address);

onUnmounted(() => {
  clearTimeout(timeOut);
  if (client) {
    client.destroy();
  }
});

watch(
  () => [selectedCurrency.value, amount.value],
  () => {
    if (amount.value.length > 0) {
      validateAmount();
    }
  }
);

async function onUpdateNetwork(event: Network) {
  selectedNetwork.value = event;
  console.log(event);
  // networkCurrencies.value = [];
  // amount.value = "";
  // amountErrorMsg.value = "";

  // if (!event.native) {
  //   if (client) {
  //     client.destroy();
  //   }

  //   disablePicker.value = true;
  //   const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
  //   const assets = network.supportedNetworks[event.key].currencies();
  //   const currencies = [];
  //   const promises = [];
  //   const filteredAssets: { [key: string]: ExternalCurrency } = {};
  //   const networkData = network?.supportedNetworks[selectedNetwork.value.key];

  //   for (const key in assets) {
  //     if (LPN_NETWORK.includes(selectedNetwork.value.key)) {
  //       let lpn = app.lpn?.find((item) => {
  //         return item.ticker == key;
  //       });

  //       if (lpn) {
  //         for (const lpn of app.lpn ?? []) {
  //           if (key == lpn.ticker) {
  //             filteredAssets[lpn.key as string] = {
  //               icon: lpn.icon,
  //               coingeckoId: lpn.coingeckoId,
  //               native: true,
  //               decimal_digits: lpn.decimal_digits,
  //               ibcData: assets[key].ibcData,
  //               key: lpn.key,
  //               name: lpn.name,
  //               shortName: lpn.shortName,
  //               symbol: lpn.symbol,
  //               ticker: lpn.ticker
  //             };
  //           }
  //         }
  //         continue;
  //       }
  //     }
  //     if (!IGNORE_TRANSFER_ASSETS.includes(key)) {
  //       filteredAssets[key] = assets[key];
  //     }
  //   }

  //   for (const key in filteredAssets) {
  //     const fn = () => {
  //       let k = filteredAssets[key].key!;
  //       let [ckey, protocol = AppUtils.getProtocols().osmosis]: string[] = k.split("@");

  //       if (LPN_NETWORK.includes(selectedNetwork.value.key)) {
  //         let lpn = app.lpn?.find((item) => {
  //           return item.key == k;
  //         });
  //         if (lpn) {
  //           ckey = filteredAssets[key].ticker;
  //         }
  //       }

  //       const ibc_route = NolusAssetUtils.makeIBCMinimalDenom(
  //         ckey,
  //         app.networksData!,
  //         networkData.key as Networks,
  //         app.networksData?.protocols[protocol].DexNetwork as string
  //       );

  //       let shortName = filteredAssets[key].shortName;
  //       let [ticker] = filteredAssets[key].key?.split("@") as string[];

  //       if (CurrencyMapping[key]) {
  //         shortName = CurrencyMapping[key].name ?? shortName;
  //         ticker = key;
  //       }

  //       if (CurrencyDemapping[ckey]) {
  //         shortName = CurrencyDemapping[ckey].name ?? shortName;
  //       }

  //       switch (selectedNetwork.value.key) {
  //         case app.networksData?.protocols[AppUtils.getProtocols().neutron].DexNetwork: {
  //           protocol = AppUtils.getProtocols().neutron as string;
  //           break;
  //         }
  //       }

  //       const icon = app.assetIcons?.[`${ticker}@${protocol}`] as string;

  //       return {
  //         balance: coin(0, ibc_route),
  //         shortName: shortName,
  //         ticker: k,
  //         name: shortName,
  //         icon: icon,
  //         decimal_digits: Number(filteredAssets[key].decimal_digits),
  //         symbol: filteredAssets[key].symbol,
  //         native: filteredAssets[key].native
  //       };
  //     };

  //     currencies.push(fn());
  //   }

  //   selectedCurrency.value = currencies?.[0];
  //   client = await WalletUtils.getWallet(event.key);

  //   const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
  //   wallet.value = baseWallet?.address as string;
  //   networkCurrenciesObject.value = filteredAssets;

  //   if (WalletUtils.isAuth()) {
  //     for (const c of currencies) {
  //       async function fn() {
  //         const balance = await client.getBalance(wallet.value as string, c.balance.denom);
  //         c.balance = balance;
  //       }
  //       promises.push(fn());
  //     }
  //   }

  //   await Promise.all(promises);

  //   networkCurrencies.value = currencies;
  //   disablePicker.value = false;
  // } else {
  //   selectedCurrency.value = walletStore.balances[0];
  //   wallet.value = walletStore.wallet?.address;
  // }
}

function onCopy() {
  copyText.value = i18n.t("message.copied");
  StringUtils.copyToClipboard(wallet.value ?? WalletManager.getWalletAddress());

  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    copyText.value = i18n.t("message.copy");
  }, 2000);
}

function receive() {
  validateInputs();
}

function handleAmountChange(event: string) {
  amount.value = event;
}

async function validateInputs() {
  try {
    isLoading.value = true;
    const isValid = await validateAmount();

    if (isValid) {
      const network =
        NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];

      fee.value = coin(network.fees.transfer_amount, selectedCurrency.value.balance.denom);
      showConfirmScreen.value = true;
    }
  } catch (error) {
    step.value = CONFIRM_STEP.ERROR;
    showConfirmScreen.value = true;
  } finally {
    isLoading.value = false;
  }
}

async function validateAmount() {
  amountErrorMsg.value = "";

  if (!WalletUtils.isAuth()) {
    return false;
  }

  if (!amount.value) {
    amountErrorMsg.value = i18n.t("message.invalid-amount");
    return false;
  }

  const prefix =
    NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key]?.prefix;
  const decimals = selectedCurrency.value?.decimal_digits;

  if (prefix && decimals) {
    try {
      const balance = await client.getBalance(wallet.value as string, selectedCurrency.value.balance.denom);
      const walletBalance = Decimal.fromAtomics(balance.amount, decimals);
      const transferAmount = Decimal.fromUserInput(amount.value, decimals);
      const isGreaterThanWalletBalance = transferAmount.isGreaterThan(walletBalance);
      const isLowerThanOrEqualsToZero = transferAmount.isLessThanOrEqual(Decimal.fromUserInput("0", decimals));

      if (isLowerThanOrEqualsToZero) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-low");
        return false;
      }

      if (isGreaterThanWalletBalance) {
        amountErrorMsg.value = i18n.t("message.invalid-balance-big");
        return false;
      }
    } catch (e) {
      Logger.error(e);
    }
  } else {
    amountErrorMsg.value = i18n.t("message.unexpected-error");
    return false;
  }

  return true;
}

async function onSendClick() {
  try {
    const networkData =
      NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
    await externalWalletOperation(ibcTransfer, client, networkData);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

function getSourceChannel() {
  const networkInfo = SUPPORTED_NETWORKS_DATA[selectedNetwork.value.key as keyof typeof SUPPORTED_NETWORKS_DATA];

  if (networkInfo.forward) {
    const [_ckey, protocol = AppUtils.getProtocols().osmosis]: string[] = selectedCurrency.value.ticker!.split("@");

    return AssetUtils.getChannelDataByProtocol(
      app.networksData?.networks?.channels!,
      app.networksData?.protocols[protocol].DexNetwork as string,
      selectedNetwork.value.key
    )!.b.ch;
  } else {
    return AssetUtils.getSourceChannel(
      app.networksData?.networks?.channels!,
      selectedNetwork.value.key,
      NATIVE_NETWORK.key,
      selectedNetwork.value.key
    );
  }
}

async function ibcTransfer(baseWallet: BaseWallet) {
  try {
    step.value = CONFIRM_STEP.PENDING;

    const networkData =
      NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
    const denom = selectedCurrency.value.balance.denom;

    const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
      amount.value,
      denom,
      selectedCurrency.value?.decimal_digits!
    );

    const funds: Coin = {
      amount: minimalDenom.amount.toString(),
      denom
    };

    const sourceChannel = getSourceChannel();
    const networkInfo = SUPPORTED_NETWORKS_DATA[selectedNetwork.value.key as keyof typeof SUPPORTED_NETWORKS_DATA];

    const rawTx: {
      toAddress: string;
      amount: Coin;
      sourcePort: string;
      sourceChannel: string;
      gasMupltiplier: number;
      gasPrice: string;
      timeOut: number;
      memo?: string;
    } = {
      toAddress: walletStore.wallet?.address as string,
      amount: funds,
      sourcePort: SOURCE_PORTS.TRANSFER,
      sourceChannel: sourceChannel as string,
      gasMupltiplier: networkData.gasMupltiplier,
      gasPrice: networkData.gasPrice,
      timeOut: networkData.ibcTransferTimeout
    };

    if (networkInfo.forward) {
      const [_ckey, protocol = AppUtils.getProtocols().osmosis]: string[] = selectedCurrency.value.ticker!.split("@");
      const proxyAddress = wallet.value as string;
      const channel = AssetUtils.getSourceChannel(
        app.networksData?.networks?.channels!,
        NATIVE_NETWORK.key,
        app.networksData?.protocols[protocol].DexNetwork as string,
        app.networksData?.protocols[protocol].DexNetwork as string
      );

      rawTx.toAddress = proxyAddress;

      rawTx.memo = JSON.stringify({
        forward: {
          receiver: walletStore.wallet!.address,
          port: SOURCE_PORTS.TRANSFER,
          channel: channel
        }
      });
    }

    const { txHash: txHashData, txBytes, usedFee } = await baseWallet.simulateSendIbcTokensTx(rawTx);
    txHash.value = txHashData;

    if (usedFee?.amount?.[0]) {
      fee.value = usedFee.amount[0];
    }

    const tx = await baseWallet.broadcastTx(txBytes as Uint8Array);
    const isSuccessful = tx?.code === 0;
    step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
    baseWallet.disconnect();

    setTimeout(async () => {
      await walletStore.UPDATE_BALANCES();
    }, 10000);
  } catch (error: Error | any) {
    switch (error.code) {
      case ErrorCodes.GasError: {
        step.value = CONFIRM_STEP.GasErrorExternal;
        break;
      }
      default: {
        step.value = CONFIRM_STEP.ERROR;
        break;
      }
    }

    if (error.message.includes("You might want to check later")) {
      step.value = CONFIRM_STEP.SUCCESS;
      return;
    }

    if (error.message.includes("Length must be a multiple of 4")) {
      step.value = CONFIRM_STEP.SUCCESS;
      return;
    }
  }
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

function onClickOkBtn() {
  closeModal();
}

function formatCurrentBalance(selectedCurrency: AssetBalance | undefined) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    if (selectedNetwork.value.native) {
      const asset = AssetUtils.getCurrencyByDenom(selectedCurrency.balance.denom);
      return CurrencyUtils.convertMinimalDenomToDenom(
        selectedCurrency.balance.amount.toString(),
        selectedCurrency.balance.denom,
        asset.ibcData,
        asset.decimal_digits
      ).toString();
    } else {
      if (selectedCurrency.decimal_digits != null && selectedCurrency.name != null) {
        return CurrencyUtils.convertMinimalDenomToDenom(
          selectedCurrency.balance.amount.toString(),
          selectedCurrency.balance.denom,
          selectedCurrency.name as string,
          selectedCurrency.decimal_digits as number
        ).toString();
      }
    }
  }
}
async function onTest() {
  try {
    const metamaskWallet = new MetaMaskWallet();
    await metamaskWallet.connect({
      chainId: `0x${(1).toString(16)}`,
      chainName: "Ethereum",
      rpcUrls: ["https://cloudflare-eth.com"],
      blockExplorerUrls: ["https://etherscan.io"],
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18
      }
    });

    const client = await SkipRouter.getClient();
    const route = await SkipRouter.getRoute("ethereum-native", "unls", "5000000000000000");
    const wallets = await getWallets(metamaskWallet, route);

    await SkipRouter.transactionMetamask(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet) => {});
  } catch (error) {
    Logger.error(error);
  }
}

async function getWallets(wallet: MetaMaskWallet, route: IObjectKeys): Promise<{ [key: string]: BaseWallet }> {
  // const native = wallet.getSigner().chainId;
  const native = walletStore.wallet.signer.chainId;

  const addrs: { [key: string]: any } = {
    ["1"]: wallet,
    [native]: walletStore.wallet
  };

  const chainToParse: { [key: string]: IObjectKeys } = {};
  const chains = (await SkipRouter.getChains()).filter((item) => {
    if (item.chainID == "1") {
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
      addrs[baseWallet.getSigner().chainId] = baseWallet;
    };
    promises.push(fn());
  }

  await Promise.all(promises);

  return addrs;
}
</script>
