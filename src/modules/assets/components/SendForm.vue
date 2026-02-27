<template>
  <div
    id="dialog-scroll"
    class="custom-scroll max-h-full flex-1 overflow-auto"
  >
    <!-- <div class="flex max-w-[190px] flex-col gap-2 px-6 py-4">
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
        :selected="network"
        :disabled="isDisabled"
      />
    </div>
    <hr class="border-border-color" /> -->
    <AdvancedFormControl
      searchable
      id="receive"
      :currencyOptions="assets"
      class="px-6 py-4"
      :label="$t('message.amount')"
      :balanceLabel="$t('message.balance')"
      placeholder="0"
      :calculated-balance="calculatedBalance"
      :pickerPlacehodler="$t('message.loading')"
      :value="amount"
      @on-selected-currency="
        (option) => {
          selectedCurrency = assets.findIndex((item) => item == option);
        }
      "
      @input="handleAmountChange"
      :is-loading-picker="disablePicker"
      :disabled-input-field="isDisabled"
      :disabled-currency-picker="disablePicker || isDisabled"
      :error-msg="amountErrorMsg"
      :selected-currency-option="currency"
      :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
      :item-template="
        (item: any) => {
          return h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value
          });
        }
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
      </div>
      <Input
        id="receipt-send-2"
        type="text"
        :inputClass="network.native ? '' : 'border-none p-0'"
        :disabled="!network.native"
        :value="walletRef"
        @input="
          (e) => {
            receiverAddress = (e.target as HTMLInputElement).value;
          }
        "
      />
    </div>

    <hr class="border-border-color" />
  </div>
  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.send')"
      :loading="isLoading"
      :disabled="isDisabled"
      @click="onSendClick"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.transferEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@keplr-wallet/types";

import { SwapStatus } from "../enums";
import { AdvancedFormControl, Button, AssetItem, Input, type AssetItemProps } from "web-components";
import { NETWORK_DATA } from "@/networks/config";
import { NATIVE_NETWORK } from "../../../config/global/network";
import { IGNORED_NETWORKS } from "../../../config/global";

import { type BaseWallet, Wallet } from "@/networks";
import {
  CONFIRM_STEP,
  type ExternalCurrency,
  type IObjectKeys,
  type Network,
  type SkipRouteConfigType
} from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useHistoryStore } from "@/common/stores/history";
import { computed, onUnmounted, ref, watch, h, inject } from "vue";
import { useI18n } from "vue-i18n";
import {
  externalWallet,
  Logger,
  transferCurrency,
  validateAddress,
  walletOperation,
  WalletUtils
} from "@/common/utils";
import { getSkipRouteConfig } from "@/common/utils/ConfigService";
import { formatDecAsUsd, formatUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { tryGetCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { coin } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { Dec } from "@keplr-wallet/unit";
import { usePricesStore } from "@/common/stores/prices";
import { ErrorCodes } from "@/config/global";
import { useConfigStore } from "@/common/stores/config";
import { HISTORY_ACTIONS } from "@/modules/history/types";
import type { Chain, RouteResponse } from "@/common/types/skipRoute";

const i18n = useI18n();

const assets = computed(() => {
  const data = [];
  for (const asset of (networkCurrenciesRef.value as ExternalCurrency[] | AssetBalance[]) ?? []) {
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const currency = tryGetCurrencyByDenom(denom!);
    if (!currency) continue; // Skip deprecated/removed denoms

    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = formatTokenBalance(value);
    const price = new Dec(pricesStore.prices[currency.key]?.price ?? 0);
    const stable = price.mul(value);

    data.push({
      name: asset.name,
      value: denom,
      label: asset.shortName!,
      shortName: asset.shortName!,
      icon: asset.icon!,
      decimal_digits: asset.decimal_digits!,
      balance: {
        value: balance,
        ticker: asset.shortName!,
        denom: asset.balance.denom,
        amount: asset.balance?.amount
      },
      ibcData: (asset as ExternalCurrency).ibcData,
      from: (asset as AssetBalance).from,
      native: asset.native!,
      symbol: asset.symbol!,
      ticker: asset.ticker!,
      stable,
      price: formatDecAsUsd(stable)
    });
  }

  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

let client: Wallet;
let timeOut!: NodeJS.Timeout;
let route: RouteResponse | null;

const walletStore = useWalletStore();
const balancesStore = useBalancesStore();
const configStore = useConfigStore();
const historyStore = useHistoryStore();
const networks = ref<Network[]>(NETWORK_DATA.list);
const pricesStore = usePricesStore();

const selectedNetwork = ref(0);
const networkCurrencies = ref<ExternalCurrency[] | AssetBalance[]>(balancesStore.filteredBalances);
const selectedCurrency = ref(0);
const amount = ref("");
const amountErrorMsg = ref("");
const txHashes = ref<{ hash: string; status: SwapStatus; url: string | null }[]>([]);

const step = ref(CONFIRM_STEP.CONFIRM);
const fee = ref<Coin>();
const isLoading = ref(false);
const disablePicker = ref(false);
const isDisabled = ref(false);
const receiverAddress = ref("");
const tempRoute = ref<IObjectKeys | null>();
let chainsData: Chain[] = [];

let skipRouteConfig: SkipRouteConfigType | null;
const id = Date.now();
const wallet = ref(walletStore.wallet?.address);
const onClose = inject("close", () => {});

const network = computed(() => {
  return networks.value[selectedNetwork.value];
});

const networkCurrenciesRef = computed(() => {
  if (network.value.native) {
    return balancesStore.filteredBalances;
  }
  return networkCurrencies.value;
});

const walletRef = computed(() => {
  if (network.value.native) {
    return "";
  }
  return wallet.value;
});

watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized) {
      onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  try {
    const [config, chns] = await Promise.all([getSkipRouteConfig(), SkipRouter.getChains()]);
    skipRouteConfig = config;
    chainsData = chns;
    const n = NETWORK_DATA.list.filter((item) => {
      if (skipRouteConfig!.transfers[item.key]) {
        return true;
      }
      return false;
    }) as Network[];
    networks.value = [...n].filter((item) => {
      return !IGNORED_NETWORKS.includes(item.key);
    });
    const index = networks.value.findIndex((item: Network) => item.key == configStore.protocolFilter);
    if (index < 0) {
      selectedNetwork.value = 0;
    } else {
      selectedNetwork.value = index;
    }
    await onUpdateNetwork(network.value);
  } catch (error) {
    Logger.error(error);
  }
}

onUnmounted(() => {
  clearTimeout(timeOut!);
  if (client && step.value != CONFIRM_STEP.PENDING) {
    destroyClient();
  }
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return formatUsd(0);
  }
  const denom = asset.ibcData ?? asset.from;
  const currency = tryGetCurrencyByDenom(denom);
  if (!currency) return formatUsd(0);

  const price = new Dec(pricesStore.prices[currency.key!]?.price ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return formatDecAsUsd(stable);
});

function destroyClient() {
  try {
    client.destroy();
  } catch {
    // intentionally empty - destroy errors are non-critical
  }
}

function setHistory() {
  const chains = getChainIds(tempRoute.value! as RouteResponse);

  const data = {
    id,
    chains,
    skipRoute: route,
    currency: currency.value.from,
    fromAddress: walletStore.wallet?.address,
    receiverAddress: wallet.value,
    type: HISTORY_ACTIONS.SEND
  };
  historyStore.addPendingTransfer(data, i18n);
}

watch(
  () => [selectedCurrency.value, amount.value, wallet.value],
  () => {
    if (amount.value.length > 0) {
      if (validateAmount() && wallet.value?.length > 0) {
        clearTimeout(timeOut);
        tempRoute.value = null;
        timeOut = setTimeout(async () => {
          try {
            tempRoute.value = await getRoute();
          } catch (e: unknown) {
            amountErrorMsg.value = e instanceof Error ? e.message : String(e);
            console.log(e);
          }
        });
      }
    }
  }
);

watch(
  () => receiverAddress.value,
  () => {
    amountErrorMsg.value = validateAddress(receiverAddress.value);
  }
);

async function onUpdateNetwork(event: Network) {
  tempRoute.value = null;
  selectedNetwork.value = networks.value.findIndex((item) => item == event);
  if (!event.native) {
    await setCosmosNetwork();
  } else {
    setNativeNetwork();
  }
}

function handleAmountChange(event: string) {
  amount.value = event;
}

async function onSubmitCosmos() {
  try {
    isDisabled.value = true;
    amountErrorMsg.value = "";

    const isValid = validateAmount();

    if (isValid) {
      route = await getRoute();
      await onSwap();
    }
  } catch (e: unknown) {
    amountErrorMsg.value = String(e);
  } finally {
    isDisabled.value = false;
  }
}

function setNativeNetwork() {
  amountErrorMsg.value = "";
  route = null;

  networkCurrencies.value = balancesStore.filteredBalances;
  selectedCurrency.value = 0;
}

async function setCosmosNetwork() {
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";
  destroyClient();

  disablePicker.value = true;
  const ntwrk = NETWORK_DATA;
  const currencies = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[network.value.key].currencies;
  for (const c of data ?? []) {
    if (c.visible && configStore.protocolFilter != c.visible) continue;

    const currency = tryGetCurrencyByDenom(c.from);
    if (!currency) continue; // Skip deprecated/removed denoms

    const balance = balancesStore.getBalanceInfo(c.from);
    currency.balance = coin(balance?.amount?.toString() ?? 0, c.to);
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
  const networkData = ntwrk?.supportedNetworks[network.value.key];
  client = await WalletUtils.getWallet(network.value.key);
  const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
  wallet.value = baseWallet?.address as string;

  networkCurrencies.value = mappedCurrencies;
  disablePicker.value = false;
  selectedCurrency.value = 0;
}

function validateAmount() {
  amountErrorMsg.value = "";

  if (!WalletUtils.isAuth()) {
    return false;
  }

  if (amount.value.at(0) == ".") {
    amountErrorMsg.value = i18n.t("message.invalid-amount");
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

async function onSendClick() {
  if (network.value.native) {
    return onSubmitNative();
  }
  onSubmitCosmos();
}

function onSubmitNative() {
  const isValid = validateAmount() && validateAddress(receiverAddress.value).length == 0;

  if (isValid) {
    onSwap();
  }
}

async function onSwap() {
  try {
    if (network.value.native) {
      await onSwapNative();
    } else {
      await onSwapCosmos();
    }
  } catch {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function onSwapNative() {
  try {
    isDisabled.value = true;
    await walletOperation(transferAmount);
  } catch {
    step.value = CONFIRM_STEP.ERROR;
  } finally {
    isDisabled.value = false;
  }
}

async function transferAmount() {
  try {
    isLoading.value = true;
    step.value = CONFIRM_STEP.PENDING;
    const asset = assets.value[selectedCurrency.value];
    const { success, txHash, txBytes, usedFee } = await transferCurrency(
      asset.balance.denom,
      amount.value,
      receiverAddress.value,
      ""
    );

    if (success) {
      const element = {
        hash: txHash,
        status: SwapStatus.pending,
        url: null as string
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

        await balancesStore.fetchBalances();
      } catch (error: unknown) {
        if (walletStore.history[id]) {
          walletStore.history[id].historyData.errorMsg = amountErrorMsg.value;
          walletStore.history[id].historyData.status = CONFIRM_STEP.ERROR;
        }
        switch ((error as { code?: number }).code) {
          case ErrorCodes.GasError: {
            step.value = CONFIRM_STEP.GasError;
            break;
          }
          default: {
            step.value = CONFIRM_STEP.ERROR;
            break;
          }
        }
      } finally {
        destroyClient();
      }
    } else {
      step.value = CONFIRM_STEP.ERROR;

      if (walletStore.history[id]) {
        walletStore.history[id].historyData.errorMsg = amountErrorMsg.value;
        walletStore.history[id].historyData.status = CONFIRM_STEP.ERROR;
      }
    }

    historyStore.loadActivities();
    onClose();
  } catch (e: unknown) {
    amountErrorMsg.value = String(e);
  } finally {
    isLoading.value = false;
  }
}

async function onSwapCosmos() {
  if (!route || !WalletUtils.isAuth() || amountErrorMsg.value.length > 0) {
    return false;
  }

  try {
    step.value = CONFIRM_STEP.PENDING;
    isDisabled.value = true;

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
        await balancesStore.fetchBalances();

        historyStore.loadActivities();

        step.value = CONFIRM_STEP.SUCCESS;
        walletStore.history[id].historyData.route.activeStep = walletStore.history[id].historyData.route.steps.length;
        walletStore.history[id].historyData.routeDetails.activeStep =
          walletStore.history[id].historyData.routeDetails.steps.length;
        walletStore.history[id].historyData.status = CONFIRM_STEP.SUCCESS;

        onClose();
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        amountErrorMsg.value = error instanceof Error ? error.message : String(error);
        Logger.error(error);

        if (walletStore.history[id]) {
          walletStore.history[id].historyData.errorMsg = amountErrorMsg.value;
          walletStore.history[id].historyData.route.steps[
            walletStore.history[id].historyData.route.activeStep
          ].approval = true;

          walletStore.history[id].historyData.routeDetails.steps[
            walletStore.history[id].historyData.routeDetails.activeStep
          ].approval = true;

          walletStore.history[id].historyData.status = CONFIRM_STEP.ERROR;
        }
      } finally {
        isLoading.value = false;
      }
    });
  } catch (e) {
    Logger.error(e);
  } finally {
    isDisabled.value = false;
    destroyClient();
  }
}

async function submit(wallets: { [key: string]: BaseWallet }) {
  await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet, chainId: string) => {
    walletStore.history[id].historyData.route.activeStep++;
    walletStore.history[id].historyData.routeDetails.activeStep++;

    const element = {
      hash: tx.txHash,
      status: SwapStatus.pending,
      url: wallet.explorer
    };

    txHashes.value.push(element);

    if (walletStore.history[id]) {
      walletStore.history[id].historyData.txHashes = txHashes.value;
    }

    await wallet.broadcastTx(tx.txBytes as Uint8Array);
    await SkipRouter.track(chainId, (tx as IObjectKeys).txHash);
    await SkipRouter.fetchStatus((tx as IObjectKeys).txHash, chainId);

    element.status = SwapStatus.success;
  });
}

async function getWallets(): Promise<{ [key: string]: BaseWallet }> {
  const native = walletStore.wallet.signer.chainId as string;
  const addrs = {
    [native]: walletStore.wallet
  };

  const chainToParse: { [key: string]: IObjectKeys } = getChains(route!);
  const promises = [];
  for (const chain in chainToParse) {
    const fn = async function () {
      if (chain != NATIVE_NETWORK.key) {
        const client = await WalletUtils.getWallet(chain);
        const network = NETWORK_DATA;
        const networkData = network?.supportedNetworks[chain];
        const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
        const chainId = await baseWallet.getChainId();
        addrs[chainId] = baseWallet;
      }
    };
    promises.push(fn());
  }

  await Promise.all(promises);
  return addrs;
}

async function getRoute() {
  const chainId = await client.getChainId();
  const asset = assets.value[selectedCurrency.value];

  const transferAmount = Decimal.fromUserInput(amount.value, asset!.decimal_digits as number);

  const route = await SkipRouter.getRoute(
    asset.from!,
    asset.balance.denom,
    transferAmount.atomics,
    false,
    undefined,
    chainId,
    {}
  );

  return route;
}

function getChains(route?: RouteResponse) {
  const chainToParse: { [key: string]: IObjectKeys } = {};
  const native = walletStore.wallet.signer.chain_id as string;
  const chains = chainsData.filter((item) => {
    if (item.chain_id == native) {
      return false;
    }
    return route!.chain_ids?.includes(item.chain_id);
  });

  const supportedNetworks = configStore.supportedNetworksData;
  for (const chain of chains) {
    for (const key in supportedNetworks) {
      const networkData = supportedNetworks[key];
      if (networkData?.value == chain.chain_name.toLowerCase()) {
        chainToParse[key] = networkData;
      }
    }
  }

  return chainToParse;
}

function getChainIds(route?: RouteResponse) {
  const chainToParse: { [key: string]: IObjectKeys } = {};
  const chains = chainsData.filter((item) => {
    return route!.chain_ids?.includes?.(item.chain_id);
  });

  const supportedNetworks = configStore.supportedNetworksData;
  for (const chain of chains) {
    for (const key in supportedNetworks) {
      const networkData = supportedNetworks[key];
      if (networkData?.value == chain.chain_name.toLowerCase()) {
        chainToParse[chain.chain_id] = networkData;
      }
    }
  }

  return chainToParse;
}
</script>
