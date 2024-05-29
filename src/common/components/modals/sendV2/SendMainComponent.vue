<template>
  <ConfirmRouteComponent
    v-if="showConfirmScreen"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txHashes="txHashes"
    :step="step"
    :fee="fee!"
    :receiverAddress="wallet"
    :errorMsg="errorMsg"
    :txs="route?.txsRequired ?? 1"
    :amount="`${swapAmount}`"
    :network="selectedNetwork"
    :onSendClick="onSwap"
    :onBackClick="onConfirmBackClick"
    :onOkClick="() => closeModal()"
    :warning="route?.warning?.message ?? ''"
  />
  <template v-else>
    <form
      @submit.prevent="onSendClick"
      class="modal-form overflow-auto"
    >
      <div
        class="modal-send-receive-input-area"
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

          <InputField
            :error-msg="receiverErrorMsg"
            :is-error="receiverErrorMsg !== ''"
            :value="receiverAddress"
            :label="$t('message.recipient')"
            id="sendTo"
            name="sendTo"
            type="text"
            @input="(event) => (receiverAddress = event.target.value)"
          />
        </div>
      </div>
      <template v-else>
        <!-- Input Area -->
        <div class="modal-send-receive-input-area background">
          <div class="block text-left">
            <div class="mt-[20px] flex flex-col">
              <Picker
                :default-option="selectedNetwork"
                :options="networks"
                :label="$t('message.network')"
                :value="selectedNetwork"
                @update-selected="onUpdateNetwork"
              />
              <button
                v-if="selectedNetwork.chain_type == 'evm'"
                class="nls-font-700 btn btn-secondary btn-medium-secondary mt-2 flex self-end !text-12 text-primary"
                type="button"
                :class="{ 'js-loading': isMetamaskLoading }"
                @click="connectEvm"
              >
                <img
                  src="@/assets/icons/metamask.svg"
                  class="mr-1"
                />
                {{ evmAddress.length == 0 ? $t("message.connect") : evmAddress }}
              </button>
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
                <template v-if="selectedNetwork.chain_type == 'cosmos'">
                  {{ wallet ?? $t("message.connect-wallet-label") }}
                </template>
                <template v-if="selectedNetwork.chain_type == 'evm'">
                  {{ evmAddress ? wallet : $t("message.connect-wallet-label") }}
                </template>
              </p>
            </div>
          </div>
        </div>
        <!-- Actions -->
      </template>
      <div class="modal-send-receive-actions background flex-col">
        <button
          class="btn btn-primary btn-large-primary"
          :class="{ 'js-loading': isLoading }"
        >
          {{ $t("message.send") }}
        </button>
        <div class="my-2 flex w-full justify-between text-[14px] text-light-blue">
          <p>{{ $t("message.estimate-time") }}:</p>
          <template v-if="selectedNetwork.chain_type == 'evm'">
            <p>
              ~{{ (selectedNetwork as EvmNetwork).estimation.duration }}
              {{ $t(`message.${(selectedNetwork as EvmNetwork).estimation.type}`) }}
            </p>
          </template>
          <template v-else>
            <p>~{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
          </template>
        </div>
      </div>
    </form>
  </template>
</template>

<script setup lang="ts">
import Picker from "@/common/components/Picker.vue";
import CurrencyField from "@/common/components/CurrencyField.vue";
import ConfirmRouteComponent from "../templates/ConfirmRouteComponent.vue";
import InputField from "@/common/components/InputField.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import type { EvmNetwork } from "@/common/types/Network";
import { onUnmounted, ref, inject, watch, onMounted, nextTick, computed } from "vue";
import { useI18n } from "vue-i18n";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { Wallet, BaseWallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import { externalWallet, transferCurrency, validateAddress, walletOperation } from "@/common/utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec, Coin as KeplrCoin } from "@keplr-wallet/unit";
import { AppUtils } from "@/common/utils";
import { ErrorCodes, GAS_FEES, IGNORE_TRANSFER_ASSETS, NATIVE_ASSET, NATIVE_NETWORK } from "@/config/global";
import { SwapStatus } from "../swap/types";
import { MetaMaskWallet } from "@/networks/metamask";

import { CONFIRM_STEP, TxType, type Network, type IObjectKeys, type SkipRouteConfigType } from "@/common/types";

import { AssetUtils, EnvNetworkUtils, Logger, SkipRouter, WalletUtils } from "@/common/utils";

export interface ReceiveComponentProps {
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  onCopyClick: (wallet?: string) => void;
}

let client: Wallet | MetaMaskWallet;
let timeOut: NodeJS.Timeout;
let route: IObjectKeys | null;

const walletStore = useWalletStore();
const networks = ref<(Network | EvmNetwork)[]>([SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key]]);
const i18n = useI18n();
const selectedNetwork = ref(networks.value[0]);
const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (b: boolean) => {});

const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const amount = ref("");
const amountErrorMsg = ref("");
const disablePicker = ref(false);
const disablePickerDialog = ref(false);
const txHashes = ref<{ hash: string; status: SwapStatus }[]>([]);
const errorMsg = ref("");

const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const fee = ref<Coin>(coin(GAS_FEES.transfer_amount, NATIVE_ASSET.denom));
const isLoading = ref(false);
const evmAddress = ref("");
const closeModal = inject("onModalClose", () => () => {});
const wallet = ref(walletStore.wallet?.address);
const isMetamaskLoading = ref(false);

const receiverErrorMsg = ref("");
const receiverAddress = ref("");

let skipRouteConfig: SkipRouteConfigType | null;

const balances = ref<AssetBalance[]>(
  walletStore.balances
    .filter((item) => {
      const currency = AssetUtils.getCurrencyByDenom(item.balance.denom);
      if (IGNORE_TRANSFER_ASSETS.includes(currency.ticker as string)) {
        return false;
      }
      return true;
    })
    .map((item) => {
      const currency = AssetUtils.getCurrencyByDenom(item.balance.denom);
      const e = {
        ...item,
        icon: currency.icon,
        shortName: currency.shortName,
        decimal_digits: currency.decimal_digits
      };
      if (e.balance.denom == walletStore.available.denom) {
        e.balance = { ...walletStore.available };
      }
      return e;
    })
);

onMounted(async () => {
  try {
    setNativeNetwork();
    skipRouteConfig = await AppUtils.getSkipRouteConfig();
    const n = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list.filter((item) => {
      if (skipRouteConfig!.transfers[item.key]) {
        return true;
      }
      return false;
    }) as (Network | EvmNetwork)[];

    networks.value = [...networks.value, ...n];
  } catch (error) {
    Logger.error(error);
  }
});

onUnmounted(() => {
  clearTimeout(timeOut);
  if (client) {
    (client as Wallet).destroy();
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

watch(
  () => receiverAddress.value,
  () => {
    receiverErrorMsg.value = validateAddress(receiverAddress.value);
  }
);

async function onUpdateNetwork(event: Network) {
  selectedNetwork.value = event;
  if (!event.native) {
    switch (event.chain_type) {
      case "cosmos": {
        setCosmosNetwork();
        break;
      }
      case "evm": {
        setEvmNetwork();
        if (client) {
          connectEvm();
        }
        break;
      }
    }
  } else {
    setNativeNetwork();
  }
}

function handleAmountChange(event: string) {
  amount.value = event;
}

async function onSubmitCosmos() {
  try {
    isLoading.value = true;
    amountErrorMsg.value = "";

    const isValid = validateAmount();

    if (isValid) {
      route = await getRoute();
      showConfirmScreen.value = true;
    }
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
    isLoading.value = false;
    showConfirmScreen.value = false;
  } finally {
    isLoading.value = false;
  }
}

function setNativeNetwork() {
  amountErrorMsg.value = "";
  receiverErrorMsg.value = "";
  route = null;
  networkCurrencies.value = balances.value;
  selectedCurrency.value = balances.value[0];
}

async function onSubmitEvm() {
  try {
    isLoading.value = true;
    amountErrorMsg.value = "";

    const isValid = validateAmount();

    if (evmAddress.value.length == 0) {
      return false;
    }

    if (isValid) {
      route = await getRoute();
      showConfirmScreen.value = true;
    }
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
    isLoading.value = false;
    showConfirmScreen.value = false;
  } finally {
    isLoading.value = false;
  }
}

async function setCosmosNetwork() {
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";
  if (client) {
    client.destroy();
  }

  disablePicker.value = true;
  const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];

  const currencies = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[selectedNetwork.value.key].currencies;
  for (const c of data ?? []) {
    const currency = AssetUtils.getCurrencyByDenom(c.from);
    const balance = walletStore.balances.find((item) => item.balance.denom == c.from);
    currency.balance = coin(balance?.balance?.amount.toString() ?? 0, c.to);
    currencies.push(currency);
  }

  const mappedCurrencies = currencies.map((item) => {
    return {
      balance: item.balance,
      shortName: item.shortName,
      ticker: item.ticker,
      name: item.shortName,
      icon: item.icon,
      decimal_digits: item.decimal_digits,
      symbol: item.symbol,
      native: item.native,
      from: item.ibcData
    };
  });

  selectedCurrency.value = mappedCurrencies?.[0];

  const networkData = network?.supportedNetworks[selectedNetwork.value.key];
  client = await WalletUtils.getWallet(selectedNetwork.value.key);
  const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
  wallet.value = baseWallet?.address as string;

  client = await WalletUtils.getWallet(selectedNetwork.value.key);

  networkCurrencies.value = mappedCurrencies;
  disablePicker.value = false;
}

async function setEvmNetwork() {
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";

  disablePicker.value = true;

  const currencies = [];
  // const promises = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[selectedNetwork.value.key].currencies;

  for (const c of data ?? []) {
    const currency = AssetUtils.getCurrencyByDenom(c.from);
    const balance = walletStore.balances.find((item) => item.balance.denom == c.from);
    currency.balance = coin(balance?.balance?.amount.toString() ?? 0, c.to);
    currencies.push(currency);
  }

  const mappedCurrencies = currencies.map((item) => {
    return {
      balance: item.balance,
      shortName: item.shortName,
      ticker: item.ticker,
      name: item.shortName,
      icon: item.icon,
      decimal_digits: item.decimal_digits,
      symbol: item.symbol,
      native: item.native,
      from: item.ibcData
    };
  });

  selectedCurrency.value = mappedCurrencies?.[0];

  networkCurrencies.value = mappedCurrencies;
  disablePicker.value = false;
}

function validateAmount() {
  amountErrorMsg.value = "";

  if (!WalletUtils.isAuth()) {
    return false;
  }

  if (!amount.value) {
    amountErrorMsg.value = i18n.t("message.invalid-amount");
    return false;
  }
  const decimals = selectedCurrency.value?.decimal_digits;
  if (decimals) {
    try {
      const balance = selectedCurrency.value.balance;
      const walletBalance = Decimal.fromAtomics(balance.amount.toString(), decimals);
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
  if (selectedNetwork.value.native) {
    return onSubmitNative();
  }

  switch (selectedNetwork.value.chain_type) {
    case "cosmos": {
      onSubmitCosmos();
      break;
    }
    case "evm": {
      onSubmitEvm();
      break;
    }
  }
}

function onSubmitNative() {
  const isValid = validateAmount() && validateAddress(receiverAddress.value).length == 0;

  if (isValid) {
    showConfirmScreen.value = true;
  }
}

async function onSwap() {
  try {
    if (selectedNetwork.value.native) {
      await onSwapNative();
    } else {
      await onSwapCosmos();
    }
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function onSwapNative() {
  try {
    await walletOperation(transferAmount);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function transferAmount() {
  step.value = CONFIRM_STEP.PENDING;

  const { success, txHash, txBytes, usedFee } = await transferCurrency(
    selectedCurrency.value.balance.denom,
    amount.value,
    receiverAddress.value,
    ""
  );

  if (success) {
    const element = {
      hash: txHash,
      status: SwapStatus.pending
    };

    const index = txHashes.value.length;
    txHashes.value.push(element);

    if (usedFee?.amount?.[0]) {
      fee.value = usedFee.amount[0];
    }

    try {
      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;
      txHashes.value[index].status = SwapStatus.success;

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

async function onSwapCosmos() {
  if (!route || !WalletUtils.isAuth() || amountErrorMsg.value.length > 0) {
    return false;
  }

  try {
    step.value = CONFIRM_STEP.PENDING;

    await walletOperation(async () => {
      try {
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

        await walletStore.UPDATE_BALANCES();
        step.value = CONFIRM_STEP.SUCCESS;
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        errorMsg.value = (error as Error).toString();
        Logger.error(error);
      }
    });
  } catch (e) {
    Logger.error(e);
  }
}

async function getWallets(): Promise<{ [key: string]: BaseWallet }> {
  const native = walletStore.wallet.signer.chainId as string;

  const addrs = {
    [native]: walletStore.wallet
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
      if (SUPPORTED_NETWORKS_DATA[key].value == chain.chainName.toLowerCase()) {
        chainToParse[key] = SUPPORTED_NETWORKS_DATA[key];
      }
    }
  }
  const promises = [];

  for (const chain in chainToParse) {
    const fn = async function () {
      switch (SUPPORTED_NETWORKS_DATA[chain].chain_type) {
        case "cosmos": {
          const client = await WalletUtils.getWallet(chain);
          const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];
          const networkData = network?.supportedNetworks[chain];
          const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
          const chainId = await baseWallet.getChainId();
          addrs[chainId] = baseWallet;
          break;
        }
        case "evm": {
          const chainId = Number((client as MetaMaskWallet).chainId).toString();
          addrs[chainId] = client;
          break;
        }
      }
    };
    promises.push(fn());
  }

  await Promise.all(promises);

  return addrs;
}

async function getRoute() {
  let chaindId = await client.getChainId();
  const transferAmount = Decimal.fromUserInput(amount.value, selectedCurrency.value!.decimal_digits as number);

  switch (selectedNetwork.value.chain_type) {
    case "evm": {
      chaindId = Number(chaindId).toString();
      break;
    }
  }

  const route = await SkipRouter.getRoute(
    selectedCurrency.value.from!,
    selectedCurrency.value.balance.denom,
    transferAmount.atomics,
    false,
    undefined,
    chaindId
  );

  return route;
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
  amount.value = "";
  setDisable(false);
  nextTick(() => {
    errorMsg.value = "";
  });
  setShowDialogHeader(true);
  step.value = CONFIRM_STEP.CONFIRM;
  route = null;
}

function formatCurrentBalance(selectedCurrency: AssetBalance | undefined) {
  if (selectedCurrency?.balance?.denom && selectedCurrency?.balance?.amount) {
    if (selectedNetwork.value.native) {
      const asset = AssetUtils.getCurrencyByDenom(selectedCurrency.balance.denom);
      return CurrencyUtils.convertMinimalDenomToDenom(
        selectedCurrency.balance.amount.toString(),
        selectedCurrency.balance.denom,
        asset.shortName,
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

async function connectEvm() {
  try {
    if (client) {
      (client as MetaMaskWallet)?.destroy();
    }
    client = new MetaMaskWallet();
    isMetamaskLoading.value = true;

    const net = selectedNetwork.value as EvmNetwork;
    const endpoint = await AppUtils.fetchEvmEndpoints(net.key);
    const chaindId = await client.getChainId(endpoint.rpc);
    await client.connect({
      chainId: chaindId,
      chainName: net.label,
      rpcUrls: [endpoint.rpc],
      blockExplorerUrls: [net.explorer],
      nativeCurrency: { ...net.nativeCurrency }
    });

    evmAddress.value = client.shortAddress;
    wallet.value = client.address;
    await setEvmNetwork();
  } catch (error) {
    Logger.error(error);
  } finally {
    isMetamaskLoading.value = false;
  }
}

const swapAmount = computed(() => {
  return `${new Dec(amount.value).toString(selectedCurrency.value?.decimal_digits)} ${selectedCurrency.value?.shortName}`;
});
</script>
