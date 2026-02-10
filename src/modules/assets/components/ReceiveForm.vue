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
      :is-loading-picker="disablePicker"
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
            balance: item.balance.value
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
  </div>
  <div class="flex flex-col gap-2 p-6">
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
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@keplr-wallet/types";

import { SwapStatus } from "../enums";
import { AdvancedFormControl, Button, Dropdown, AssetItem, Input, Size, type AssetItemProps } from "web-components";
import { NETWORK_DATA } from "@/networks/config";
import { NATIVE_NETWORK } from "../../../config/global/network";
import { IGNORED_NETWORKS } from "../../../config/global";

import { type BaseWallet, Wallet } from "@/networks";
import { CONFIRM_STEP, type IObjectKeys, type Network, type SkipRouteConfigType } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { computed, onUnmounted, ref, watch, h, inject } from "vue";
import { useI18n } from "vue-i18n";
import { externalWallet, Logger, walletOperation, WalletUtils } from "@/common/utils";
import { formatNumber, formatDecAsUsd, formatUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTickerForNetwork, tryGetCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { getSkipRouteConfig } from "@/common/utils/ConfigService";
import { coin } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { Dec } from "@keplr-wallet/unit";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { useHistoryStore } from "@/common/stores/history";
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import type { RouteResponse, Chain } from "@/common/types/skipRoute";

const i18n = useI18n();

const assets = computed(() => {
  const data = [];

  for (const asset of networkCurrencies.value ?? []) {
    const currency = tryGetCurrencyByDenom(asset.from!);
    if (!currency) continue; // Skip deprecated/removed denoms

    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = formatNumber(value.toString(), asset.decimal_digits!);

    const price = new Dec(pricesStore.prices[currency.key]?.price ?? 0);
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
      price: formatDecAsUsd(stable)
    });
  }
  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

let client: Wallet;
let timeOut!: NodeJS.Timeout;
let route: RouteResponse | null;

const walletStore = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const historyStore = useHistoryStore();
const networks = ref<Network[]>(NETWORK_DATA.list);

const selectedNetwork = ref(0);
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
const tempRoute = ref<IObjectKeys | null>();
let chainsData: Chain[] = [];

const wallet = ref(walletStore.wallet?.address);
let skipRouteConfig: SkipRouteConfigType | null;
let id = Date.now();
const onClose = inject("close", () => {});

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
    await onUpdateNetwork(networks.value[selectedNetwork.value]);
  } catch (error) {
    Logger.error(error);
  }
}

onUnmounted(() => {
  if (client && step.value != CONFIRM_STEP.PENDING) {
    destroyClient();
  }

  clearTimeout(timeOut!);
});

const network = computed(() => {
  return networks.value[selectedNetwork.value];
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return formatUsd(0);
  }

  const currency = tryGetCurrencyByDenom(asset.from!);
  if (!currency) return formatUsd(0);

  const price = new Dec(pricesStore.prices[currency.key!]?.price ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return formatDecAsUsd(stable);
});

function destroyClient() {
  try {
    client.destroy();
  } catch (error) {}
}

function setHistory() {
  const chains = getChainIds(tempRoute.value! as RouteResponse);

  const data = {
    id,
    chains,
    skipRoute: route,
    fromAddress: wallet.value,
    currency: currency.value.from,
    receiverAddress: walletStore.wallet.address,
    type: HYSTORY_ACTIONS.RECEIVE
  };
  historyStore.addPendingTransfer(data, i18n);
}

watch(
  () => [selectedCurrency.value, amount.value],
  () => {
    if (amount.value.length > 0) {
      validateAmount();
    }
  }
);

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
          } catch (e: Error | any) {
            console.log(e);
            amountErrorMsg.value = e.message;
          }
        });
      }
    }
  }
);

async function onUpdateNetwork(event: Network) {
  tempRoute.value = null;
  selectedNetwork.value = networks.value.findIndex((item) => item == event);
  if (!event.native) {
    await setCosmosNetwork();
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
      const networkdata = NETWORK_DATA?.supportedNetworks[network.value.key];
      const currency = getCurrencyByTickerForNetwork(networkdata.ticker);
      fee.value = coin(networkdata.fees.transfer_amount, currency.ibcData);
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
  const ntwrk = NETWORK_DATA;

  const currencies = [];
  const promises = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[network.value.key].currencies;
  for (const c of data ?? []) {
    if (c.visible && configStore.protocolFilter != c.visible) continue;

    const currency = tryGetCurrencyByDenom(c.from);
    if (!currency) continue; // Skip deprecated/removed denoms

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

  const networkData = ntwrk?.supportedNetworks[network.value.key];
  client = await WalletUtils.getWallet(network.value.key);
  const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
  wallet.value = baseWallet?.address as string;

  if (WalletUtils.isAuth()) {
    for (const c of mappedCurrencies) {
      async function fn() {
        const balance = await client.getBalance(wallet.value as string, c.balance.denom);
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

async function onSwap() {
  try {
    isDisabled.value = true;
    await onSubmitCosmos();
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
        await balancesStore.fetchBalances();

        historyStore.loadActivities();
        step.value = CONFIRM_STEP.SUCCESS;
        walletStore.history[id].historyData.route.activeStep = walletStore.history[id].historyData.route.steps.length;
        walletStore.history[id].historyData.routeDetails.activeStep =
          walletStore.history[id].historyData.routeDetails.steps.length;
        walletStore.history[id].historyData.status = CONFIRM_STEP.SUCCESS;
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        amountErrorMsg.value = (error as Error).toString();

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
  onClose();
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
      const client = await WalletUtils.getWallet(chain);
      const network = NETWORK_DATA;
      const networkData = network?.supportedNetworks[chain];
      const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
      const chainId = await baseWallet.getChainId();
      addrs[chainId] = baseWallet;
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
    asset.balance.denom,
    asset.from!,
    transferAmount.atomics,
    false,
    chainId,
    null,
    {}
  );
  return route;
}

function getChains(route?: RouteResponse) {
  const chainToParse: { [key: string]: IObjectKeys } = {};
  const native = walletStore.wallet.signer.chainId as string;

  const chains = chainsData.filter((item) => {
    if (item.chain_id == native) {
      return false;
    }
    return route!.chain_ids.includes(item.chain_id);
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
    return route!.chain_ids.includes(item.chain_id);
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
