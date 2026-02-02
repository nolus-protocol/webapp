<template>
  <div
    id="dialog-scroll"
    class="custom-scroll max-h-full flex-1 overflow-auto"
  >
    <MultipleCurrencyComponent
      :currency-options="assets"
      :itemsHeadline="[$t('message.assets'), $t('message.balance')]"
      :selected-first-currency-option="selectedAsset"
      :selected-second-currency-option="selectedSecondCurrencyOption"
      :disabled="disabledByWallet || disabled || loadingTx"
      @on-first-change="updateAmount"
      @on-second-change="updateSwapToAmount"
      :first-input-value="firstInputAmount?.toString()"
      :second-input-value="secondInputAmount?.toString()"
      :first-calculated-balance="firstCalculatedBalance"
      :second-calculated-balance="secondCalculatedBalance"
      :error-msg="error"
      @swap="onSwapItems"
      :item-template="
        (item) =>
          h<AssetItemProps>(AssetItem, {
            ...item,
            abbreviation: item.label,
            name: item.name,
            balance: item.balance.value
          })
      "
    />
    <div class="flex justify-end border-b border-t border-border-color px-6 py-4">
      <div class="flex flex-[3] flex-col gap-3 text-right text-16 font-normal text-typography-secondary">
        <p class="flex gap-1 self-end">{{ $t("message.price-impact") }}:</p>
        <p class="flex gap-1 self-end">
          {{ $t("message.estimated-tx-fee") }}:
          <span class="w-[18px]"> </span>
        </p>
      </div>
      <div
        class="ml-2 flex flex-[1] flex-col justify-between gap-2 text-right text-16 font-semibold text-typography-default"
      >
        <template v-if="loading">
          <p class="align-center flex justify-end">
            <span class="state-loading !w-[60px]"> </span>
          </p>
          <p class="align-center flex justify-end">
            <span class="state-loading !w-[60px]"> </span>
          </p>
        </template>
        <template v-else>
          <p class="align-center flex justify-end">{{ priceImapact }}%</p>
          <p class="align-center flex justify-end whitespace-pre">
            {{ swapFee }}
          </p>
        </template>
      </div>
    </div>

    <!-- <div class="mt-4 flex flex-col justify-end px-4">
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
            label: $t('message.swap'),
            icon: NATIVE_NETWORK.icon,
            // token: {
            //   balance: formatNumber(amount, selectedAsset?.decimal_digits),
            //   symbol: selectedAsset?.label
            // },
            tokenComponent: () =>
              h(
                'div',
                `${formatNumber(amount, NATIVE_CURRENCY.maximumFractionDigits)} ${selectedAsset?.label} > ${formatNumber(swapToAmount, NATIVE_CURRENCY.maximumFractionDigits)} ${selectedSecondCurrencyOption?.label}`
              ),
            meta: () => h('div', `${NATIVE_NETWORK.label}`)
          }
        ]"
        :variant="StepperVariant.MEDIUM"
      />
    </div> -->
    <!-- <hr class="my-4 border-border-color" /> -->
  </div>
  <div class="flex flex-col gap-2 p-6">
    <Button
      size="large"
      severity="primary"
      :label="$t('message.swap')"
      :loading="loading || loadingTx"
      :disabled="disabledByWallet || disabled"
      @click="onNextClick"
    />
    <p class="text-center text-12 text-typography-secondary">
      {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.longOperationsEstimation }}{{ $t("message.sec") }}
    </p>
  </div>
</template>

<script lang="ts" setup>
import MultipleCurrencyComponent from "@/common/components/MultipleCurrencyComponent.vue";
import { Button, type AssetItemProps, AssetItem, type AdvancedCurrencyFieldOption } from "web-components";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
import { computed, inject, ref, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import {
  externalWallet,
  Logger,
  validateAmountV2,
  walletOperation,
  WalletUtils
} from "@/common/utils";
import { getSkipRouteConfig } from "@/common/utils/ConfigService";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { usePricesStore } from "@/common/stores/prices";
import { h } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { MultipleCurrencyEventType, type IObjectKeys, type SkipRouteConfigType } from "@/common/types";
import { useI18n } from "vue-i18n";
import { type BaseWallet } from "@/networks";
import { SwapStatus } from "../enums";
import { NETWORK_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { useConfigStore } from "@/common/stores/config";
import { useHistoryStore } from "@/common/stores/history";
import { StepperVariant, Stepper } from "web-components";
import type { RouteResponse } from "@/common/types/skipRoute";
import { WalletTypes } from "@/networks/types";

let time: NodeJS.Timeout;
let route: RouteResponse | null;
const timeOut = 600;
const id = Date.now();

const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const historyStore = useHistoryStore();
const i18n = useI18n();

const blacklist = ref<string[]>([]);
const selectedFirstCurrencyOption = ref<AdvancedCurrencyFieldOption | undefined>();
const selectedSecondCurrencyOption = ref<AdvancedCurrencyFieldOption | undefined>();
const amount = ref("0");
const swapToAmount = ref("0");
const error = ref("");
const txHashes = ref<{ hash: string; status: SwapStatus; url: string | null }[]>([]);

const firstInputAmount = ref();
const secondInputAmount = ref();
const showDetails = ref(false);

const swapFee = ref("");
const loading = ref(false);
const disabled = ref(false);
const loadingTx = ref(false);
const priceImapact = ref(0);
const onClose = inject("close", () => {});

const disabledByWallet = computed(() => {
  switch (wallet.wallet?.signer?.type) {
    case WalletTypes.evm: {
      return true;
    }
    default: {
      return false;
    }
  }
});

const assets = computed(() => {
  const data = [];

  for (const asset of balances.value ?? []) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = formatNumber(value.toString(), asset.decimal_digits);

    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
    const stable = price.mul(value);

    data.push({
      name: asset.name,
      value: asset.key,
      label: asset.shortName,
      icon: asset.icon,
      ibcData: asset.ibcData,
      decimal_digits: asset.decimal_digits,
      balance: { value: balance, ticker: asset.shortName },
      stable,
      price: `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    });
  }

  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const firstCalculatedBalance = computed(() => {
  const price = new Dec(pricesStore.prices[selectedFirstCurrencyOption.value?.value!]?.price ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

const secondCalculatedBalance = computed(() => {
  const price = new Dec(pricesStore.prices[selectedSecondCurrencyOption.value?.value!]?.price ?? 0);
  const v = swapToAmount?.value?.length ? swapToAmount?.value : "0";
  const stable = price.mul(new Dec(v));
  return `${NATIVE_CURRENCY.symbol}${formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`;
});

const selectedAsset = computed(() => {
  const item = assets.value.find((item) => item.value == selectedFirstCurrencyOption.value?.value)!;
  return item;
});

const balances = computed(() => {
  return balancesStore.filteredBalances.filter((item) => {
    if (balancesStore.ignoredCurrencies.includes(item.ticker as string)) {
      return false;
    }
    return !blacklist.value.includes(item.ibcData);
  });
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
    const config = await getSkipRouteConfig();
    const protocol = configStore.protocolFilter.toLowerCase();
    blacklist.value = config.blacklist;
    selectedFirstCurrencyOption.value = assets.value.find(
      (item) => item.ibcData == config[`swap_currency_${protocol}` as keyof SkipRouteConfigType]
    )!;
    selectedSecondCurrencyOption.value = assets.value.find((item) => item.ibcData == config.swap_to_currency)!;

    setSwapFee();
  } catch (error) {
    Logger.error(error);
  }
}

async function onNextClick() {
  if (validateInputs().length == 0) {
    try {
      disabled.value = true;
      await walletOperation(onSwap);
    } catch (e) {
      Logger.error(e);
    } finally {
      disabled.value = false;
    }
  }
}

function updateAmount(value: IObjectKeys) {
  amount.value = value.input.value ?? 0;
  selectedFirstCurrencyOption.value = assets.value.find((item) => item.value == value.currency.value)!;
  updateRoute();
}

function updateSwapToAmount(value: IObjectKeys) {
  swapToAmount.value = value.input.value;
  selectedSecondCurrencyOption.value = assets.value.find((item) => item.value == value.currency.value)!;

  switch (value.type) {
    case MultipleCurrencyEventType.select: {
      updateRoute();
      break;
    }
    case MultipleCurrencyEventType.input: {
      updateSwapToRoute();
      break;
    }
  }
}

function onSwapItems() {
  const secondItem = selectedSecondCurrencyOption.value;
  selectedSecondCurrencyOption.value = selectedFirstCurrencyOption.value;
  selectedFirstCurrencyOption.value = secondItem;
  updateRoute();
}

async function setSwapFee() {
  const amount = swapToAmount.value;
  const asset = selectedSecondCurrencyOption.value;

  if (asset) {
    const config = await getSkipRouteConfig();
    const fee = new Dec(config.fee).quo(new Dec(10000)).mul(new Dec(amount, asset.decimal_digits));
    const coin = CurrencyUtils.convertDenomToMinimalDenom(fee.toString(), asset.ibcData, asset.decimal_digits);
    swapFee.value = CurrencyUtils.convertMinimalDenomToDenom(
      coin.amount.toString(),
      asset.ibcData,
      asset.label,
      asset.decimal_digits
    )
      .trim(true)
      .toString();
  }
}

function updateRoute() {
  if (!amount.value.length || amount.value.length == 0) {
    return false;
  }

  if (validateInputs().length == 0) {
    const token = CurrencyUtils.convertDenomToMinimalDenom(
      amount.value.toString(),
      selectedFirstCurrencyOption.value!.ibcData,
      selectedFirstCurrencyOption.value!.decimal_digits
    );
    if (token.amount.gt(new Int(0))) {
      setRoute(token, false);
    }
  }
}

function updateSwapToRoute() {
  if (validateSwapToInputs().length == 0) {
    const token = CurrencyUtils.convertDenomToMinimalDenom(
      swapToAmount.value.toString(),
      selectedSecondCurrencyOption.value!.ibcData,
      selectedSecondCurrencyOption.value!.decimal_digits
    );
    if (token.amount.gt(new Int(0))) {
      setRoute(token, true);
    }
  }
}

async function setRoute(token: Coin, revert = false) {
  clearTimeout(time);

  time = setTimeout(async () => {
    try {
      loading.value = true;
      error.value = "";
      if (revert) {
        route = await SkipRouter.getRoute(
          selectedFirstCurrencyOption.value!.ibcData,
          selectedSecondCurrencyOption.value!.ibcData,
          token.amount.toString(),
          revert
        );
        firstInputAmount.value = new Dec(route?.amount_in, selectedFirstCurrencyOption.value!.decimal_digits).toString(
          selectedFirstCurrencyOption.value!.decimal_digits
        );
        amount.value = secondInputAmount.value;
      } else {
        route = await SkipRouter.getRoute(
          selectedFirstCurrencyOption.value!.ibcData,
          selectedSecondCurrencyOption.value!.ibcData,
          token.amount.toString(),
          revert
        );
        secondInputAmount.value = new Dec(
          route?.amount_out,
          selectedSecondCurrencyOption.value!.decimal_digits
        ).toString(selectedSecondCurrencyOption.value!.decimal_digits);
        swapToAmount.value = secondInputAmount.value;
      }
      priceImapact.value = Number(route?.swap_price_impact_percent ?? "0");
      setSwapFee();
    } catch (e) {
      error.value = (e as Error).message;
      route = null;
      Logger.error(e);
    } finally {
      loading.value = false;
    }
  }, timeOut);
}

function validateInputs() {
  error.value = validateAmountV2(amount.value, selectedFirstCurrencyOption.value!.balance!.value);
  if (selectedFirstCurrencyOption.value!.ibcData === selectedSecondCurrencyOption.value!.ibcData) {
    error.value = i18n.t("message.swap-same-error");
  }
  return error.value;
}

function validateSwapToInputs() {
  error.value = validateAmountV2(swapToAmount.value, selectedSecondCurrencyOption.value!.balance!.value);
  if (selectedFirstCurrencyOption.value!.ibcData === selectedSecondCurrencyOption.value!.ibcData) {
    error.value = i18n.t("message.swap-same-error");
  }
  return error.value;
}

async function onSwap() {
  if (!WalletUtils.isAuth() || !route) {
    return false;
  }

  try {
    loadingTx.value = true;

    const wallets = await getWallets();
    const addresses: Record<string, string> = {};

    for (const key in wallets) {
      addresses[key] = wallets[key].address!;
    }

    await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, baseWallet: BaseWallet) => {
      const element = {
        hash: tx.txHash,
        status: SwapStatus.pending,
        url: baseWallet.explorer
      };

      txHashes.value.push(element);
      await baseWallet.broadcastTx(tx.txBytes as Uint8Array);
      const chainid = await baseWallet.getChainId();
      await SkipRouter.track(chainid, (tx as IObjectKeys).txHash);
      await SkipRouter.fetchStatus((tx as IObjectKeys).txHash, chainid);

      element.status = SwapStatus.success;
      await balancesStore.fetchBalances();
      historyStore.loadActivities();
      onClose();
    });

    if (wallet.history[id]) {
      wallet.history[id].txHashes = txHashes.value;
    }
  } catch (e) {
    error.value = (e as Error).toString();
    Logger.error(error);

    if (wallet.history[id]) {
      wallet.history[id].errorMsg = error.value;
    }
  } finally {
    loadingTx.value = false;
  }
}

async function getWallets(): Promise<{ [key: string]: BaseWallet }> {
  const native = wallet.wallet.signer.chainId as string;
  const addrs = {
    [native]: wallet.wallet
  };

  const chainToParse: { [key: string]: IObjectKeys } = {};
  const chains = (await SkipRouter.getChains()).filter((item) => {
    if (item.chain_id == native) {
      return false;
    }
    return route!.chain_ids.includes(item.chain_id);
  });

  for (const chain of chains) {
    for (const key in SUPPORTED_NETWORKS_DATA) {
      const networkData = SUPPORTED_NETWORKS_DATA[key];
      if (networkData?.value == chain.chain_name) {
        chainToParse[key] = networkData;
      }
    }
  }
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
</script>
