<template>
  <div class="custom-scroll max-h-full flex-1 overflow-auto">
    <div class="flex max-w-[190px] flex-col gap-2 px-6 py-4">
      <label
        for="dropdown-btn-network"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.network") }}</label
      >
      <Dropdown
        id="network"
        :on-select="onUpdateNetwork"
        :options="networks"
        :size="Size.medium"
        searchable
        :selected="selectedNetwork"
        :disabled="isDisabled"
      />
    </div>
    <hr class="border-border-color" />
    <AdvancedFormControl
      id="receive"
      searchable
      :currencyOptions="assets"
      class="px-6 py-4"
      :label="$t('message.amount')"
      :balanceLabel="$t('message.balance')"
      placeholder="0"
      :calculated-balance="calculatedBalance"
      :pickerPlacehodler="$t('message.loading')"
      @on-selected-currency="
        (option) => {
          selectedCurrency = assets.findIndex((item) => item == option);
        }
      "
      @input="handleAmountChange"
      :value="amount"
      :is-loading-picker="disablePicker || isDisabled"
      :disabled-input-field="isDisabled"
      :disabled-currency-picker="disablePicker || isDisabled"
      :error-msg="amountErrorMsg"
      :selected-currency-option="assets[selectedCurrency]"
      :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
      :item-template="
        (item: any) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value,
            max_decimals: item.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : item.decimal_digits
          })
      "
    />
    <div class="relative flex items-center justify-center">
      <hr class="border-border-color" />
      <Button
        severity="secondary"
        icon="arrow-down"
        size="large"
        class="pointer-events-none absolute cursor-none !p-[9px]"
      />
    </div>
    <hr class="border-border-color" />
    <div class="flex flex-col gap-2 px-6 py-4">
      <div class="flex items-center gap-1">
        <label
          for="input-receipt-send-2"
          class="text-16 font-semibold text-typography-default"
          >{{ $t("message.recipient") }}</label
        >
        <Tooltip
          position="top"
          :content="$t('message.receive-tooltip')"
        >
          <SvgIcon
            name="help"
            class="rounded-full"
            size="s"
          />
        </Tooltip>
      </div>
      <Input
        id="receipt-send-2"
        type="text"
        :disabled="true"
        inputClass="border-none p-0"
        :value="walletStore.wallet?.address ? walletStore.wallet?.address : $t('message.connect-wallet-label')"
      />
    </div>

    <hr class="my-4 border-border-color" />

    <div class="mt-4 flex flex-col justify-end px-4">
      <Button
        v-if="showDetails"
        :label="$t('message.hide-transaction-details')"
        @click="showDetails = !showDetails"
        severity="tertiary"
        icon="minus"
        iconPosition="left"
        size="small"
        class="self-end text-icon-default"
      />

      <Button
        v-else
        :label="$t('message.show-transaction-details')"
        @click="showDetails = !showDetails"
        severity="tertiary"
        icon="plus"
        iconPosition="left"
        size="small"
        class="self-end text-icon-default"
      />

      <Stepper
        v-if="showDetails"
        :active-step="-1"
        :steps="[
          {
            label: $t('message.send-stepper'),
            icon: selectedNetwork.icon,
            token: {
              balance: AssetUtils.formatNumber(amount, assets[selectedCurrency]?.decimal_digits),
              symbol: assets[selectedCurrency]?.shortName
            },
            meta: () => h('div', `${selectedNetwork.label} > ${NATIVE_NETWORK.label}`)
          },
          {
            label: $t('message.receive-stepper'),
            icon: NATIVE_NETWORK.icon,
            token: {
              balance: AssetUtils.formatNumber(amount, assets[selectedCurrency]?.decimal_digits),
              symbol: assets[selectedCurrency]?.shortName
            },
            meta: () => h('div', `${NATIVE_NETWORK.label}`)
          }
        ]"
        :variant="StepperVariant.MEDIUM"
      />
    </div>
    <hr class="my-4 border-border-color" />
  </div>
  <div class="flex flex-col gap-2 p-6">
    <button
      v-if="selectedNetwork.chain_type == 'evm'"
      :class="{ 'js-loading': isMetamaskLoading }"
      class="bmt-2 flex items-center !text-12 font-semibold text-neutral-typography-200"
      type="button"
      @click="connectEvm"
    >
      <component :is="connection?.icon" />
      {{ evmAddress == null || evmAddress?.length == 0 ? $t("message.connect") : evmAddress }}
    </button>
    <Button
      size="large"
      severity="primary"
      :label="$t('message.receive')"
      :loading="isLoading"
      :disabled="isDisabled"
      @click="onSwap"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.transferEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import KeplrIcon from "@/assets/icons/wallets/keplr.svg";
import LedgerIcon from "@/assets/icons/wallets/ledger.svg";
import LeapIcon from "@/assets/icons/wallets/leapwallet.svg";
import type { EvmNetwork } from "@/common/types/Network";
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@keplr-wallet/types";

import { SwapStatus } from "../enums";
import {
  AdvancedFormControl,
  Button,
  Dropdown,
  AssetItem,
  Input,
  Size,
  SvgIcon,
  Tooltip,
  type AssetItemProps
} from "web-components";
import { MetaMaskWallet } from "@/networks/metamask";
import { NETWORK_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { MAX_DECIMALS } from "../../../config/global";

import { BaseWallet, Wallet } from "@/networks";
import {
  CONFIRM_STEP,
  WalletConnectMechanism,
  type IObjectKeys,
  type Network,
  type SkipRouteConfigType
} from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { computed, onMounted, onUnmounted, ref, watch, h, inject, type FunctionalComponent } from "vue";
import { useI18n } from "vue-i18n";
import {
  AppUtils,
  WalletManager,
  AssetUtils,
  externalWallet,
  Logger,
  walletOperation,
  WalletUtils
} from "@/common/utils";
import { coin } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/common/stores/oracle";
import { StepperVariant, Stepper } from "web-components";

const i18n = useI18n();
const connections: {
  [key: string]: {
    icon: FunctionalComponent | string;
    label: string;
  };
} = {
  [WalletConnectMechanism.KEPLR]: {
    icon: KeplrIcon,
    label: i18n.t("message.keplr")
  },
  [WalletConnectMechanism.LEAP]: {
    icon: LeapIcon,
    label: i18n.t("message.leap")
  },
  [WalletConnectMechanism.LEDGER]: {
    icon: LedgerIcon,
    label: i18n.t("message.ledger")
  },
  [WalletConnectMechanism.LEDGER_BLUETOOTH]: {
    icon: LedgerIcon,
    label: i18n.t("message.ledger")
  }
};
const type = WalletManager.getWalletConnectMechanism();
const connection = connections[type as keyof typeof WalletConnectMechanism];
const showDetails = ref(false);

const assets = computed(() => {
  const data = [];

  for (const asset of networkCurrencies.value ?? []) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = AssetUtils.formatNumber(value.toString(), asset.decimal_digits!);

    const currency = AssetUtils.getCurrencyByDenom(asset.from!);
    const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);
    const stable = price.mul(value);
    data.push({
      name: currency.name,
      value: asset.from!,
      label: currency.shortName,
      shortName: currency.shortName,
      icon: currency.icon,
      decimal_digits: currency.decimal_digits,
      balance: {
        value: balance,
        ticker: currency.shortName!,
        denom: asset.balance.denom,
        amount: asset.balance?.amount
      },
      from: asset.from,
      native: asset.native,
      sybmol: asset.symbol,
      ticker: asset.ticker,
      stable,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    });
  }
  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

let client: Wallet | MetaMaskWallet;
let timeOut: NodeJS.Timeout;
let route: IObjectKeys | null;

const walletStore = useWalletStore();
const networks = ref<(Network | EvmNetwork)[]>([SUPPORTED_NETWORKS_DATA.OSMOSIS]);
const oracle = useOracleStore();

const selectedNetwork = ref(networks.value[0]);
const networkCurrencies = ref<AssetBalance[]>([]);
const selectedCurrency = ref(0);
const amount = ref("");
const amountErrorMsg = ref("");
const txHashes = ref<{ hash: string; status: SwapStatus; url: string | null }[]>([]);

const step = ref(CONFIRM_STEP.CONFIRM);
const fee = ref<Coin>();
const isLoading = ref(false);
const disablePicker = ref(false);
const isDisabled = ref(false);
const evmAddress = ref("");

const wallet = ref(walletStore.wallet?.address);
const isMetamaskLoading = ref(false);
let skipRouteConfig: SkipRouteConfigType | null;
let id = Date.now();
const onClose = inject("close", () => {});
const test = inject("update-activities", () => {});

onMounted(async () => {
  try {
    skipRouteConfig = await AppUtils.getSkipRouteConfig();
    const n = NETWORK_DATA.list.filter((item) => {
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

  clearTimeout(timeOut!);
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
  }

  const currency = AssetUtils.getCurrencyByDenom(asset.from!);
  const price = new Dec(oracle.prices?.[currency.key!]?.amount ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

function destroyClient() {
  try {
    client.destroy();
  } catch (error) {}
}

function setHistory() {
  // if (params.data == null) {
  //   const data = {
  //     id,
  //     skipRouteConfig,
  //     wallet: wallet.value,
  //     route,
  //     selectedNetwork: selectedNetwork.value,
  //     selectedCurrency: selectedCurrency.value,
  //     amount: amount.value,
  //     txHashes: txHashes.value,
  //     step: step.value,
  //     fee: fee.value,
  //     fromAddress: wallet.value,
  //     action: HYSTORY_ACTIONS.RECEIVE,
  //     errorMsg: errorMsg.value
  //   };
  //   walletStore.updateHistory(data);
  // }
}

// watch(
//   () => params.data,
//   () => {
//     setParams();
//   },
//   {
//     deep: true
//   }
// );

function setParams() {
  // if (params.data) {
  //   id = params.data.id;
  //   skipRouteConfig = params.data.skipRouteConfig;
  //   wallet.value = params.data.wallet;
  //   route = params.data.route;
  //   selectedNetwork.value = params.data.selectedNetwork;
  //   amount.value = params.data.amount;
  //   txHashes.value = params.data.txHashes;
  //   step.value = params.data.step;
  //   fee.value = params.data.fee;
  //   wallet.value = params.data.fromAddress;
  //   showConfirmScreen.value = true;
  //   selectedCurrency.value = params.data.selectedCurrency;
  //   errorMsg.value = params.data.errorMsg;
  // }
}

watch(
  () => [selectedCurrency.value, amount.value],
  () => {
    if (amount.value.length > 0) {
      validateAmount();
    }
  }
);

async function onUpdateNetwork(event: Network | EvmNetwork) {
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

function handleAmountChange(event: string) {
  amount.value = event;
}

async function onSubmitCosmos() {
  try {
    amountErrorMsg.value = "";
    const isValid = validateAmount();

    if (isValid) {
      route = await getRoute();
      const network = NETWORK_DATA?.supportedNetworks[selectedNetwork.value.key];
      const currency = AssetUtils.getCurrencyByTicker(network.ticker);
      fee.value = coin(network.fees.transfer_amount, currency.ibcData);
    }
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
  }
}

async function onSubmitEvm() {
  try {
    amountErrorMsg.value = "";
    const isValid = validateAmount();

    if (isValid) {
      route = await getRoute();
      const network = selectedNetwork.value as EvmNetwork;
      fee.value = coin(network.fees.transfer, network.nativeCurrency.symbol);
    }
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
  }
}

async function setCosmosNetwork() {
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";
  destroyClient();

  disablePicker.value = true;
  const network = NETWORK_DATA;

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
  selectedCurrency.value = 0;
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
  selectedCurrency.value = 0;
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
  const asset = assets.value[selectedCurrency.value];

  const decimals = asset?.decimal_digits;
  if (decimals) {
    try {
      const balance = asset.balance;
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

async function loadRoute() {
  switch (selectedNetwork.value.chain_type) {
    case "cosmos": {
      return onSubmitCosmos();
    }
    case "evm": {
      return onSubmitEvm();
    }
  }
}

async function onSwap() {
  try {
    isDisabled.value = true;
    await loadRoute();
    await onSubmit();
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  } finally {
    isDisabled.value = false;
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
        isLoading.value = true;

        const wallets = await getWallets();
        const addresses: Record<string, string> = {};

        for (const key in wallets) {
          addresses[key] = wallets[key].address!;
        }

        setHistory();
        await submit(wallets);
        await walletStore.UPDATE_BALANCES();

        walletStore.loadActivities();
        step.value = CONFIRM_STEP.SUCCESS;
        if (walletStore.history[id]) {
          walletStore.history[id].step = CONFIRM_STEP.SUCCESS;
        }
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        amountErrorMsg.value = (error as Error).toString();

        if (walletStore.history[id]) {
          walletStore.history[id].step = CONFIRM_STEP.ERROR;
          walletStore.history[id].errorMsg = amountErrorMsg.value;
        }
        Logger.error(error);
      } finally {
        isLoading.value = false;
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
  onClose();
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
          const network = NETWORK_DATA;
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
  const asset = assets.value[selectedCurrency.value];

  const transferAmount = Decimal.fromUserInput(amount.value, asset!.decimal_digits as number);

  switch (selectedNetwork.value.chain_type) {
    case "evm": {
      chaindId = Number(chaindId).toString();
      break;
    }
  }

  const route = await SkipRouter.getRoute(asset.balance.denom, asset.from!, transferAmount.atomics, false, chaindId);

  return route;
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
</script>
