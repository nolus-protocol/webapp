<template>
  <ConfirmRouteComponent
    v-if="showConfirmScreen"
    :txType="$t(`message.${TxType.SEND}`) + ':'"
    :txHashes="txHashes"
    :step="step"
    :fee="fee!"
    :receiverAddress="walletStore.wallet?.address"
    :errorMsg="errorMsg"
    :txs="route!.txsRequired"
    :amount="`${swapAmount}`"
    :network="selectedNetwork"
    :onSendClick="onSwap"
    :onBackClick="onConfirmBackClick"
    :onOkClick="() => closeModal()"
    :warning="route?.warning?.message ?? ''"
    :fromAddress="wallet"
    :fromNetwork="selectedNetwork.label"
    :toNetwork="SUPPORTED_NETWORKS_DATA[NATIVE_NETWORK.key].label"
  />
  <template v-else>
    <!-- <div
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
    </div> -->
    <!-- <template v-else> -->
    <form
      @submit.prevent="onSendClick"
      class="modal-form overflow-auto"
    >
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
  <!-- </template> -->
</template>

<script setup lang="ts">
import Picker from "@/common/components/Picker.vue";
import CurrencyField from "@/common/components/CurrencyField.vue";
import ConfirmRouteComponent from "../templates/ConfirmRouteComponent.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import { onUnmounted, ref, inject, watch, onMounted, nextTick, computed, type PropType } from "vue";
import { DocumentDuplicateIcon } from "@heroicons/vue/24/solid";
import { useI18n } from "vue-i18n";
import { NETWORKS_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { Wallet, BaseWallet } from "@/networks";
import { coin, type Coin } from "@cosmjs/amino";
import { Decimal } from "@cosmjs/math";
import { externalWallet, walletOperation } from "@/common/utils";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec, Coin as KeplrCoin } from "@keplr-wallet/unit";
import { AppUtils } from "@/common/utils";
import { NATIVE_NETWORK } from "@/config/global";
import type { EvmNetwork } from "@/common/types/Network";
import { SwapStatus } from "../swap/types";
import { MetaMaskWallet } from "@/networks/metamask";

import { CONFIRM_STEP, TxType, type Network, type IObjectKeys, type SkipRouteConfigType } from "@/common/types";

import {
  AssetUtils,
  EnvNetworkUtils,
  Logger,
  SkipRouter,
  StringUtils,
  WalletManager,
  WalletUtils
} from "@/common/utils";
import { HYSTORY_ACTIONS } from "@/modules/history/types";

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
const txHashes = ref<{ hash: string; status: SwapStatus }[]>([]);
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
  if (step.value == CONFIRM_STEP.PENDING && params.data == null) {
    const data = {
      id,
      skipRouteConfig,
      wallet: wallet,
      client,
      route,
      selectedNetwork: selectedNetwork.value,
      selectedCurrency: selectedCurrency.value,
      amount: amount.value,
      txHashes: txHashes.value,
      step: step.value,
      fee: fee.value,
      fromAddress: wallet,
      action: HYSTORY_ACTIONS.RECEIVEV2,
      errorMsg: errorMsg.value
    };
    walletStore.updateHistory(data);
  }

  if (client && step.value != CONFIRM_STEP.PENDING) {
    client.destroy();
  }

  clearTimeout(timeOut);
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
    skipRouteConfig = params.data.skipRouteConfig;
    wallet.value = params.data.wallet;
    client = params.data.client;
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
        setCosmosNetwork();
        break;
      }
      case "evm": {
        if (client) {
          connectEvm();
        } else {
          setEvmNetwork();
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
  if (client) {
    client.destroy();
  }

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

  client = await WalletUtils.getWallet(selectedNetwork.value.key);

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
    if (client) {
      (client as Wallet).destroy();
    }
  }
}

async function submit(wallets: { [key: string]: BaseWallet | MetaMaskWallet }) {
  await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet, chaindId: string) => {
    switch (wallet.constructor) {
      case MetaMaskWallet: {
        await SkipRouter.track(chaindId, (tx as IObjectKeys).hash);
        await SkipRouter.fetchStatus((tx as IObjectKeys).hash, chaindId);
        const element = {
          hash: tx.hash,
          status: SwapStatus.success
        };
        txHashes.value.push(element);
        break;
      }
      default: {
        const element = {
          hash: tx.txHash,
          status: SwapStatus.pending
        };

        const index = txHashes.value.length;
        txHashes.value.push(element);

        await wallet.broadcastTx(tx.txBytes as Uint8Array);
        await SkipRouter.track(chaindId, (tx as IObjectKeys).txHash);
        await SkipRouter.fetchStatus((tx as IObjectKeys).txHash, chaindId);

        txHashes.value[index].status = SwapStatus.success;
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
          const client = new MetaMaskWallet();
          const net = selectedNetwork.value as EvmNetwork;
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
    if (client) {
      (client as MetaMaskWallet)?.destroy();
    }
    client = new MetaMaskWallet();
    isMetamaskLoading.value = true;

    const net = selectedNetwork.value as EvmNetwork;
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
