<template>
  <ConfirmRouteComponent
    v-if="showConfirmScreen"
    :amount="`${swapAmount}`"
    :errorMsg="errorMsg"
    :fee="calculateFee(fee!)"
    :fromAddress="params.data?.wallet ?? wallet"
    :fromNetwork="selectedNetwork.label"
    :network="selectedNetwork"
    :onBackClick="onConfirmBackClick"
    :onOkClick="() => closeModal()"
    :onSendClick="onSwap"
    :receiverAddress="walletStore.wallet?.address"
    :step="step"
    :swap-to-amount="swapToAmount()"
    :toNetwork="SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key].label"
    :txHashes="txHashes"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txs="route!.txsRequired"
    :warning="route?.warning?.message ?? ''"
  />
  <template v-else>
    <form
      class="flex flex-col gap-6 overflow-auto px-10 pb-8 pt-6"
      @submit.prevent="onSendClick"
    >
      <!-- Input Area -->
      <div class="flex flex-col gap-6 text-left">
        <div class="flex flex-col">
          <Picker
            :default-option="selectedNetwork"
            :label="$t('message.network')"
            :options="networks"
            :value="selectedNetwork"
            @update-selected="onUpdateNetwork"
          />
          <button
            v-if="selectedNetwork.chain_type == 'evm'"
            :class="{ 'js-loading': isMetamaskLoading }"
            class="btn btn-secondary btn-medium-secondary mt-2 flex self-end !text-12 font-semibold text-neutral-typography-200"
            type="button"
            @click="connectEvm"
          >
            <img
              class="mr-1"
              src="@/assets/icons/metamask.svg"
            />
            {{ evmAddress == null || evmAddress?.length == 0 ? $t("message.connect") : evmAddress }}
          </button>
        </div>
        <CurrencyField
          id="amount"
          :balance="formatCurrentBalance(selectedCurrency)"
          :currency-options="networkCurrencies"
          :disabled-currency-picker="disablePicker || disablePickerDialog"
          :error-msg="amountErrorMsg"
          :is-error="amountErrorMsg !== ''"
          :is-loading-picker="disablePicker"
          :label="$t('message.amount-receive')"
          :name="$t('message.amount')"
          :option="selectedCurrency"
          :total="new KeplrCoin(selectedCurrency.balance.denom, selectedCurrency.balance.amount)"
          :value="amount"
          @input="handleAmountChange($event)"
          @update-currency="(event: AssetBalance) => (selectedCurrency = event)"
        />
        <div>
          <p class="mb-[6px] mt-2 text-14 font-medium text-neutral-typography-200">
            {{ $t("message.recipient") }}
          </p>
          <p class="break-all text-14 font-semibold text-neutral-typography-200">
            {{ WalletUtils.isAuth() ? walletStore.wallet?.address : $t("message.connect-wallet-label") }}
          </p>
        </div>
      </div>
      <!-- Actions -->
      <div class="flex flex-col gap-6">
        <Button
          :label="$t('message.receive')"
          :loading="isLoading"
          severity="primary"
          size="large"
          type="submit"
        />
        <div class="flex w-full justify-between text-[14px] text-neutral-400">
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

<script lang="ts" setup>
import Picker from "@/common/components/Picker.vue";
import CurrencyField from "@/common/components/CurrencyField.vue";
import ConfirmRouteComponent from "../templates/ConfirmRouteComponent.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import { computed, inject, nextTick, onMounted, onUnmounted, type PropType, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { BaseWallet, Wallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import {
  AppUtils,
  AssetUtils,
  EnvNetworkUtils,
  externalWallet,
  Logger,
  SkipRouter,
  StringUtils,
  WalletManager,
  walletOperation,
  WalletUtils
} from "@/common/utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Coin as KeplrCoin, Dec } from "@keplr-wallet/unit";
import { NATIVE_NETWORK } from "@/config/global";
import type { EvmNetwork } from "@/common/types/Network";
import { SwapStatus } from "../swap/types";
import { MetaMaskWallet } from "@/networks/metamask";

import { CONFIRM_STEP, type IObjectKeys, type Network, type SkipRouteConfigType, TxType } from "@/common/types";
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import { Button } from "web-components";

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
const networks = ref<(Network | EvmNetwork)[]>([SUPPORTED_NETWORKS_DATA.OSMOSIS]);

const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const selectedNetwork = ref(networks.value[0]);
const setShowDialogHeader = inject("setShowDialogHeader", (n: boolean) => {});
const setDisable = inject("setDisable", (b: boolean) => {});

const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref<AssetBalance>(walletStore.balances[0]);
const amount = ref("");
const amountErrorMsg = ref("");
const disablePicker = ref(false);
const disablePickerDialog = ref(false);
const txHashes = ref<{ hash: string; status: SwapStatus; url: string | null }[]>([]);
const errorMsg = ref("");

const showConfirmScreen = ref(false);
const step = ref(CONFIRM_STEP.CONFIRM);
const fee = ref<Coin>();
const isLoading = ref(false);
const evmAddress = ref("");

const closeModal = inject("onModalClose", () => () => {});

const wallet = ref(walletStore.wallet?.address);
const isMetamaskLoading = ref(false);
let skipRouteConfig: SkipRouteConfigType | null;
let id = Date.now();

const params = defineProps({
  data: {
    type: Object as PropType<IObjectKeys | null>
  }
});

onMounted(async () => {
  try {
    skipRouteConfig = await AppUtils.getSkipRouteConfig();
    const n = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()].list.filter((item) => {
      if (skipRouteConfig!.transfers[item.key]) {
        return true;
      }
      return false;
    }) as (Network | EvmNetwork)[];

    networks.value = [...n];
    onUpdateNetwork(SUPPORTED_NETWORKS_DATA.OSMOSIS as any);
    setParams();
  } catch (error) {
    Logger.error(error);
  }
});

onUnmounted(() => {
  if (client && step.value != CONFIRM_STEP.PENDING) {
    destroyClient();
  }

  clearTimeout(timeOut);
});

function destroyClient() {
  try {
    client.destroy();
  } catch (error) {}
}

function setHistory() {
  if (params.data == null) {
    const data = {
      id,
      skipRouteConfig,
      wallet: wallet.value,
      route,
      selectedNetwork: selectedNetwork.value,
      selectedCurrency: selectedCurrency.value,
      amount: amount.value,
      txHashes: txHashes.value,
      step: step.value,
      fee: fee.value,
      fromAddress: wallet.value,
      action: HYSTORY_ACTIONS.RECEIVE,
      errorMsg: errorMsg.value
    };
    walletStore.updateHistory(data);
  }
}

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
    skipRouteConfig = params.data.skipRouteConfig;
    wallet.value = params.data.wallet;
    route = params.data.route;
    selectedNetwork.value = params.data.selectedNetwork;
    amount.value = params.data.amount;
    txHashes.value = params.data.txHashes;
    step.value = params.data.step;
    fee.value = params.data.fee;
    wallet.value = params.data.fromAddress;
    showConfirmScreen.value = true;
    selectedCurrency.value = params.data.selectedCurrency;
    errorMsg.value = params.data.errorMsg;
  }
}

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
  if (!event.native) {
    switch (event.chain_type) {
      case "cosmos": {
        await setCosmosNetwork();
        break;
      }
      case "evm": {
        if (client) {
          await connectEvm();
        } else {
          await setEvmNetwork();
        }
        break;
      }
    }
  }
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
      const network =
        NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()]?.supportedNetworks[selectedNetwork.value.key];
      const currency = AssetUtils.getCurrencyByTicker(network.ticker);
      fee.value = coin(network.fees.transfer_amount, currency.ibcData);
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

async function onSubmitEvm() {
  try {
    isLoading.value = true;
    amountErrorMsg.value = "";
    const isValid = validateAmount();

    if (isValid) {
      route = await getRoute();
      const network = selectedNetwork.value as EvmNetwork;
      fee.value = coin(network.fees.transfer, network.nativeCurrency.symbol);
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
  destroyClient();

  disablePicker.value = true;
  const network = NETWORKS_DATA[EnvNetworkUtils.getStoredNetworkName()];

  const currencies = [];
  const promises = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[selectedNetwork.value.key].currencies;

  for (const c of data ?? []) {
    const currency = AssetUtils.getCurrencyByDenom(c.from);
    currency.balance = coin(0, c.to);
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

  if (WalletUtils.isAuth()) {
    for (const c of mappedCurrencies) {
      async function fn() {
        const balance = await (client as Wallet).getBalance(wallet.value as string, c.balance.denom);
        c.balance = balance;
      }
      promises.push(fn());
    }
  }

  await Promise.all(promises);

  networkCurrencies.value = mappedCurrencies;
  disablePicker.value = false;
}

async function setEvmNetwork() {
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";

  disablePicker.value = true;

  const currencies = [];
  const promises = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[selectedNetwork.value.key].currencies;

  for (const c of data ?? []) {
    const currency = AssetUtils.getCurrencyByDenom(c.from);
    currency.native = c.native;
    currency.balance = coin(0, c.to);
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

  if (client instanceof MetaMaskWallet) {
    for (const c of mappedCurrencies) {
      async function fn() {
        if (c.native) {
          const balance = await (client as MetaMaskWallet).getBalance();
          c.balance.amount = balance;
        } else {
          const balance = await (client as MetaMaskWallet).getContractBalance(c.balance.denom);
          c.balance.amount = balance;
        }
      }
      promises.push(fn());
    }
  }

  await Promise.all(promises);

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

async function onSwap() {
  try {
    await onSubmit();
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function onSubmit() {
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

        setHistory();
        await submit(wallets);

        await walletStore.UPDATE_BALANCES();
        step.value = CONFIRM_STEP.SUCCESS;
        if (walletStore.history[id]) {
          walletStore.history[id].step = CONFIRM_STEP.SUCCESS;
        }
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        errorMsg.value = (error as Error).toString();

        if (walletStore.history[id]) {
          walletStore.history[id].step = CONFIRM_STEP.ERROR;
          walletStore.history[id].errorMsg = errorMsg.value;
        }
        Logger.error(error);
      }
    });
  } catch (e) {
    Logger.error(e);
  } finally {
    destroyClient();
  }
}

async function submit(wallets: { [key: string]: BaseWallet | MetaMaskWallet }) {
  await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet, chaindId: string) => {
    switch (wallet.constructor) {
      case MetaMaskWallet: {
        const element = {
          hash: tx.hash,
          status: SwapStatus.pending,
          url: wallet.explorer
        };
        txHashes.value.push(element);
        if (walletStore.history[id]) {
          walletStore.history[id].txHashes = txHashes.value;
        }

        await SkipRouter.track(chaindId, (tx as IObjectKeys).hash);
        await SkipRouter.fetchStatus((tx as IObjectKeys).hash, chaindId);
        element.status = SwapStatus.success;

        break;
      }
      default: {
        const element = {
          hash: tx.txHash,
          status: SwapStatus.pending,
          url: wallet.explorer
        };

        const index = txHashes.value.length;
        txHashes.value.push(element);

        if (walletStore.history[id]) {
          walletStore.history[id].txHashes = txHashes.value;
        }

        await wallet.broadcastTx(tx.txBytes as Uint8Array);
        await SkipRouter.track(chaindId, (tx as IObjectKeys).txHash);
        await SkipRouter.fetchStatus((tx as IObjectKeys).txHash, chaindId);

        element.status = SwapStatus.success;

        break;
      }
    }
  });
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
      switch (chainToParse[chain].chain_type) {
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
          const net = selectedNetwork.value as EvmNetwork;
          const client = new MetaMaskWallet(net.explorer);
          const endpoint = await AppUtils.fetchEvmEndpoints(net.key);
          const chainId = await client.getChainId(endpoint.rpc);

          await client.connect({
            chainId: chainId,
            chainName: net.label,
            rpcUrls: [endpoint.rpc],
            blockExplorerUrls: [net.explorer],
            nativeCurrency: { ...net.nativeCurrency }
          });
          addrs[parseInt(chainId).toString()] = client;

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
    selectedCurrency.value.balance.denom,
    selectedCurrency.value.from!,
    transferAmount.atomics,
    false,
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
  if (selectedCurrency?.balance?.denom) {
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

async function connectEvm() {
  try {
    destroyClient();
    isMetamaskLoading.value = true;

    const net = selectedNetwork.value as EvmNetwork;
    client = new MetaMaskWallet(net.explorer);
    const endpoint = await AppUtils.fetchEvmEndpoints(net.key);
    const chaindId = await client.getChainId(endpoint.rpc);
    await client.connect(
      {
        chainId: chaindId,
        chainName: net.label,
        rpcUrls: [endpoint.rpc],
        blockExplorerUrls: [net.explorer],
        nativeCurrency: { ...net.nativeCurrency }
      },
      async () => {
        try {
          evmAddress.value = (client as MetaMaskWallet).shortAddress;
          wallet.value = (client as MetaMaskWallet).address;
          await setEvmNetwork();
        } catch (error) {
          Logger.error(error);
        }
      }
    );

    evmAddress.value = client.shortAddress;
    wallet.value = client.address;

    await setEvmNetwork();
  } catch (error: Error | any) {
    Logger.error(error);
    amountErrorMsg.value = error.toString();
  } finally {
    isMetamaskLoading.value = false;
    disablePicker.value = false;
  }
}

const swapAmount = computed(() => {
  return `${new Dec(amount.value).toString(selectedCurrency.value?.decimal_digits)} ${selectedCurrency.value?.shortName}`;
});

function swapToAmount() {
  return `${new Dec(route!.amountOut, selectedCurrency.value?.decimal_digits).toString(selectedCurrency.value?.decimal_digits)} ${selectedCurrency.value?.shortName}`;
}

function calculateFee(coin: Coin) {
  switch (selectedNetwork.value.chain_type) {
    case "cosmos": {
      return calculateCosmosFee(coin);
    }
    case "evm": {
      return calculateEvmFee(coin);
    }
  }
  return "";
}

function calculateCosmosFee(coin: Coin) {
  const asset = AssetUtils.getCurrencyByDenom(coin.denom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    asset.ibcData,
    asset.shortName,
    asset.decimal_digits
  ).toString();
}

function calculateEvmFee(coin: Coin) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    coin.denom,
    coin.denom,
    (selectedNetwork.value as EvmNetwork).nativeCurrency.decimals
  ).toString();
}
</script>
