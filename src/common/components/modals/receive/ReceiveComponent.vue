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
              @click="
                modelValue?.onCopyClick(wallet);
                onCopy();
              "
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
import { CONFIRM_STEP, TxType, type Network, NetworkTypes, type ExternalCurrency } from "@/common/types";
import { onUnmounted, ref, type PropType, inject, watch, computed } from "vue";
import { DocumentDuplicateIcon } from "@heroicons/vue/24/solid";
import { useI18n } from "vue-i18n";
import { AssetUtils, EnvNetworkUtils, Logger, WalletUtils } from "@/common/utils";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { Wallet, BaseWallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import { externalWalletOperation, externalWallet } from "@/common/utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec, Coin as KeplrCoin } from "@keplr-wallet/unit";
import { useApplicationStore } from "@/common/stores/application";
import { onMounted } from "vue";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { Networks } from "@nolus/nolusjs/build/types/Networks";
import { AppUtils } from "@/common/utils";

import { ErrorCodes, IGNORE_TRANSFER_ASSETS, LPN_NETWORK, NATIVE_NETWORK, ProtocolsConfig } from "@/config/global";
import { CurrencyDemapping, CurrencyMapping, SOURCE_PORTS } from "@/config/currencies";

export interface ReceiveComponentProps {
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  dialogSelectedCurrency: string;
  onCopyClick: (wallet?: string) => void;
}

let timeOut: NodeJS.Timeout;
let client: Wallet;
const props = defineProps({
  modelValue: {
    type: Object as PropType<ReceiveComponentProps>
  }
});

const walletStore = useWalletStore();
const app = useApplicationStore();

const networks = computed(() => {
  const n: string[] = [];
  if ((props.modelValue?.dialogSelectedCurrency.length as number) > 0) {
    const [ckey, protocol]: string[] = props.modelValue!.dialogSelectedCurrency.split("@");

    let lpn = app.lpn?.find((item) => {
      return item.key == props.modelValue!.dialogSelectedCurrency;
    });

    n.push(NATIVE_NETWORK.key);

    if (ckey == NATIVE_NETWORK.symbol) {
      n.push(app.networksData?.protocols[AppUtils.getProtocols().neutron].DexNetwork as string);
    }

    if (lpn) {
      const [key, protocol] = lpn.key!.split("@");
      n.push(app.networksData?.protocols[protocol].DexNetwork as string);

      for (const ntw of LPN_NETWORK) {
        n.push(ntw);
      }
    } else {
      for (const key in app.networks ?? {}) {
        if (app.networks?.[key][ckey] && !ProtocolsConfig[protocol].ignoreNetowrk.includes(key)) {
          n.push(key);
        }
      }
    }

    return NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list.filter((item) => n.includes(item.key));
  }
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
let wallet = ref(walletStore.wallet?.address);

onMounted(() => {
  if ((props.modelValue?.dialogSelectedCurrency.length as number) > 0) {
    const currency = app.currenciesData?.[props.modelValue?.dialogSelectedCurrency!]!;
    selectedCurrency.value = {
      balance: {
        amount: "0",
        denom: currency.ibcData
      },
      decimal_digits: Number(currency.decimal_digits),
      icon: app.assetIcons?.[currency.key!],
      name: currency.shortName,
      native: false,
      shortName: currency.shortName,
      symbol: currency.symbol,
      ticker: currency.key
    };
    disablePickerDialog.value = true;
    const [_ckey, protocol]: string[] = props.modelValue!.dialogSelectedCurrency.split("@");
    const n =
      app.networksData?.protocols[protocol].DexNetwork ??
      app.networksData?.protocols[AppUtils.getProtocols().osmosis].DexNetwork;
    onUpdateNetwork(SUPPORTED_NETWORKS_DATA[n as string] as Network);
  }
});

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
  networkCurrencies.value = [];

  if (!event.native) {
    if (client) {
      client.destroy();
    }

    disablePicker.value = true;

    const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
    const assets = network.supportedNetworks[event.key].currencies();
    const currencies = [];
    const promises = [];
    const filteredAssets: { [key: string]: ExternalCurrency } = {};
    const networkData = network?.supportedNetworks[selectedNetwork.value.key];

    for (const key in assets) {
      if (LPN_NETWORK.includes(selectedNetwork.value.key)) {
        let lpn = app.lpn?.find((item) => {
          return item.ticker == key;
        });

        if (lpn) {
          for (const lpn of app.lpn ?? []) {
            if (key == lpn.ticker) {
              filteredAssets[lpn.key as string] = {
                icon: lpn.icon,
                coingeckoId: lpn.coingeckoId,
                native: true,
                decimal_digits: lpn.decimal_digits,
                ibcData: assets[key].ibcData,
                key: lpn.key,
                name: lpn.name,
                shortName: lpn.shortName,
                symbol: lpn.symbol,
                ticker: lpn.ticker
              };
            }
          }
          continue;
        }
      }
      if (!IGNORE_TRANSFER_ASSETS.includes(key)) {
        filteredAssets[key] = assets[key];
      }
    }
    for (const key in filteredAssets) {
      const fn = () => {
        let k = filteredAssets[key].key!;
        let [ckey, protocol = AppUtils.getProtocols().osmosis]: string[] = k.split("@");

        if (LPN_NETWORK.includes(selectedNetwork.value.key)) {
          let lpn = app.lpn?.find((item) => {
            return item.key == k;
          });
          if (lpn) {
            ckey = filteredAssets[key].ticker;
          }
        }

        const ibc_route = NolusAssetUtils.makeIBCMinimalDenom(
          ckey,
          app.networksData!,
          networkData.key as Networks,
          app.networksData?.protocols[protocol].DexNetwork as string
        );

        // const balance = WalletUtils.isAuth()
        //   ? await client.getBalance(wallet.value as string, ibc_route)
        //   : coin(0, ibc_route);

        let shortName = filteredAssets[key].shortName;
        let [ticker] = filteredAssets[key].key?.split("@") as string[];

        if (CurrencyMapping[key]) {
          shortName = CurrencyMapping[key].name ?? shortName;
          ticker = key;
        }

        if (CurrencyDemapping[ckey]) {
          shortName = CurrencyDemapping[ckey].name ?? shortName;
        }

        switch (selectedNetwork.value.key) {
          case app.networksData?.protocols[AppUtils.getProtocols().neutron].DexNetwork: {
            protocol = AppUtils.getProtocols().neutron as string;
            break;
          }
        }

        const icon = app.assetIcons?.[`${ticker}@${protocol}`] as string;

        return {
          balance: coin(0, ibc_route),
          shortName: shortName,
          ticker: k,
          name: shortName,
          icon: icon,
          decimal_digits: Number(filteredAssets[key].decimal_digits),
          symbol: filteredAssets[key].symbol,
          native: filteredAssets[key].native
        };
      };

      currencies.push(fn());
    }

    if ((props.modelValue?.dialogSelectedCurrency.length as number) > 0) {
      const [ckey]: string[] = props.modelValue!.dialogSelectedCurrency.split("@");
      const c = currencies.find((e) => e.ticker == ckey || e.ticker == props.modelValue!.dialogSelectedCurrency)!;
      selectedCurrency.value = c;
    } else {
      selectedCurrency.value = currencies?.[0];
    }

    client = await WalletUtils.getWallet(event.key);

    const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
    wallet.value = baseWallet?.address as string;
    networkCurrenciesObject.value = filteredAssets;

    if (WalletUtils.isAuth()) {
      for (const c of currencies) {
        async function fn() {
          const balance = await client.getBalance(wallet.value as string, c.balance.denom);
          c.balance = balance;
        }
        promises.push(fn());
      }
    }

    await Promise.all(promises);

    networkCurrencies.value = currencies;
    disablePicker.value = false;
  } else {
    selectedCurrency.value = walletStore.balances[0];
    wallet.value = walletStore.wallet?.address;
  }
}

function onCopy() {
  copyText.value = i18n.t("message.copied");
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
      gasMuplttiplier: number;
      gasPrice: string;
      timeOut: number;
      memo?: string;
    } = {
      toAddress: walletStore.wallet?.address as string,
      amount: funds,
      sourcePort: SOURCE_PORTS.TRANSFER,
      sourceChannel: sourceChannel as string,
      gasMuplttiplier: networkData.gasMuplttiplier,
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
</script>
