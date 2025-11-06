<template>
  <div
    id="dialog-scroll"
    class="custom-scroll max-h-full flex-1 overflow-auto"
  >
    <div class="flex max-w-[190px] flex-col gap-2 px-6 py-4">
      <label
        for="dropdown-btn-network"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.network") }}</label
      >
      <Dropdown
        id="network"
        :on-select="onUpdateNetwork"
        :options="all_networks"
        :size="Size.medium"
        searchable
        :selected="network"
        :disabled="isDisabled"
      />
    </div>
    <hr class="border-border-color" />
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
      :is-loading-picker="disablePicker || isDisabled || isMetamaskLoading"
      :disabled-input-field="isDisabled || isMetamaskLoading"
      :disabled-currency-picker="disablePicker || isDisabled || isMetamaskLoading"
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
        :steps="steps"
        :variant="StepperVariant.MEDIUM"
      />
    </div>
    <hr class="my-4 border-border-color" />
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
import { ChainType, type EvmNetwork } from "@/common/types/Network";
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@keplr-wallet/types";

import { SwapStatus } from "../enums";
import { AdvancedFormControl, Button, Dropdown, AssetItem, Input, Size, type AssetItemProps } from "web-components";
import { MetaMaskWallet } from "@/networks/metamask";
import { NETWORK_DATA, SUPPORTED_NETWORKS_DATA } from "@/networks/config";
import { NATIVE_CURRENCY, NATIVE_NETWORK } from "../../../config/global/network";
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
import { computed, onMounted, onUnmounted, ref, watch, h, inject } from "vue";
import { useI18n } from "vue-i18n";
import {
  AppUtils,
  AssetUtils,
  externalWallet,
  Logger,
  transferCurrency,
  validateAddress,
  walletOperation,
  WalletUtils
} from "@/common/utils";
import { coin } from "@cosmjs/stargate";
import { Decimal } from "@cosmjs/math";
import { SkipRouter } from "@/common/utils/SkipRoute";
import { Dec } from "@keplr-wallet/unit";
import { useOracleStore } from "@/common/stores/oracle";
import { ErrorCodes } from "@/config/global";
import { StepperVariant, Stepper } from "web-components";
import { useApplicationStore } from "@/common/stores/application";
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import type { Chain, RouteResponse } from "@/common/types/skipRoute";
import { WalletTypes } from "@/networks/types";

const i18n = useI18n();
const showDetails = ref(false);

const assets = computed(() => {
  const data = [];
  for (const asset of (networkCurrenciesRef.value as ExternalCurrency[] | AssetBalance[]) ?? []) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = AssetUtils.formatNumber(value.toString(), asset.decimal_digits!);
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const currency = AssetUtils.getCurrencyByDenom(denom!);
    const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);
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
      sybmol: asset.symbol!,
      ticker: asset.ticker!,
      stable,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    });
  }

  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

let client: Wallet | MetaMaskWallet;
let timeOut!: NodeJS.Timeout;
let route: RouteResponse | null;

const walletStore = useWalletStore();
const app = useApplicationStore();
const networks = ref<(Network | EvmNetwork | any)[]>(NETWORK_DATA.list);
const oracle = useOracleStore();

const selectedNetwork = ref(0);
const networkCurrencies = ref<ExternalCurrency[] | AssetBalance[]>(walletStore.currencies);
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
const receiverAddress = ref("");
const tempRoute = ref<IObjectKeys | null>();
let chainsData: Chain[] = [];

let skipRouteConfig: SkipRouteConfigType | null;
let id = Date.now();
const wallet = ref(walletStore.wallet?.address);
const isMetamaskLoading = ref(false);
const onClose = inject("close", () => {});

const all_networks = computed<(Network | EvmNetwork | any)[]>(() => {
  switch (walletStore.wallet?.signer?.type) {
    case WalletTypes.evm: {
      return networks.value.filter((item: Network) => item.chain_type == ChainType.evm);
    }
    default: {
      return networks.value;
    }
  }
});

const network = computed(() => {
  return all_networks.value[selectedNetwork.value];
});

const networkCurrenciesRef = computed(() => {
  if (network.value.native) {
    return walletStore.currencies;
  }
  return networkCurrencies.value;
});

const walletRef = computed(() => {
  if (network.value.native) {
    return "";
  }
  return wallet.value;
});

const steps = computed(() => {
  if (tempRoute.value && network.value.chain_type == "evm") {
    const chains = getChainIds(tempRoute.value as RouteResponse);
    const stps = [];
    for (const [index, operation] of (tempRoute.value?.operations ?? []).entries()) {
      if (operation.go_fast_transfer || operation.transfer || operation.cctp_transfer) {
        const op = operation.go_fast_transfer ?? operation.transfer ?? operation.cctp_transfer;
        const from = chains[op.from_chain_id];
        const to = chains[op.to_chain_id];
        let label = i18n.t("message.send-stepper");

        if (index > 0 && index < tempRoute.value?.operations.length) {
          label = i18n.t("message.swap-stepper");
        }

        stps.push({
          label,
          icon: from.icon,
          token: {
            balance: AssetUtils.formatNumber(
              new Dec(index == 0 ? operation.amount_in : operation.amount_out, currency.value?.decimal_digits).toString(
                currency.value?.decimal_digits
              ),
              currency.value?.decimal_digits
            ),
            symbol: currency.value?.shortName
          },
          meta: () => h("div", `${from.label} > ${to.label}`)
        });

        if (index == tempRoute.value?.operations.length - 1) {
          stps.push({
            label: i18n.t("message.receive-stepper"),
            icon: to.icon,
            token: {
              balance: AssetUtils.formatNumber(
                new Dec(operation.amount_out, currency.value?.decimal_digits).toString(currency.value?.decimal_digits),
                currency.value?.decimal_digits
              ),
              symbol: currency.value?.shortName
            },
            meta: () => h("div", `${to.label}`)
          });
        }
      }
    }

    return stps;
  }

  return [
    {
      label: i18n.t("message.send-stepper"),
      icon: NATIVE_NETWORK.icon,
      token: {
        balance: AssetUtils.formatNumber(amount.value, currency.value?.decimal_digits),
        symbol: currency.value?.shortName
      },
      meta: () => h("div", `${NATIVE_NETWORK.label} > ${network.value.label}`)
    },
    {
      label: i18n.t("message.receive-stepper"),
      icon: network.value.icon,
      token: {
        balance: AssetUtils.formatNumber(amount.value, currency.value?.decimal_digits),
        symbol: currency.value?.shortName
      },
      meta: () => h("div", `${network.value.label}`)
    }
  ];
});

onMounted(async () => {
  try {
    const [config, chns] = await Promise.all([AppUtils.getSkipRouteConfig(), SkipRouter.getChains()]);
    skipRouteConfig = config;
    chainsData = chns;
    const n = NETWORK_DATA.list.filter((item) => {
      if (skipRouteConfig!.transfers[item.key]) {
        return true;
      }
      return false;
    }) as (Network | EvmNetwork)[];
    networks.value = [...n].filter((item) => {
      return !IGNORED_NETWORKS.includes(item.key);
    });
    const index = all_networks.value.findIndex((item: Network) => item.key == app.protocolFilter);
    if (index < 0) {
      selectedNetwork.value = 0;
    } else {
      selectedNetwork.value = index;
    }
    await onUpdateNetwork(network.value);
  } catch (error) {
    Logger.error(error);
  }
});

onUnmounted(() => {
  clearTimeout(timeOut!);
  if (client && step.value != CONFIRM_STEP.PENDING) {
    destroyClient();
  }
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber("0.00", NATIVE_CURRENCY.maximumFractionDigits)}`;
  }
  const denom = asset.ibcData ?? asset.from;
  const currency = AssetUtils.getCurrencyByDenom(denom);

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
  const chains = getChainIds(tempRoute.value! as RouteResponse);

  const data = {
    id,
    chains,
    skipRoute: route,
    currency: currency.value.from,
    fromAddress: walletStore.wallet?.address,
    receiverAddress: wallet.value,
    type: HYSTORY_ACTIONS.SEND
  };
  walletStore.updateHistory(data, i18n);
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
          } catch (e: Error | any) {
            amountErrorMsg.value = e.message;
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
  selectedNetwork.value = all_networks.value.findIndex((item) => item == event);
  if (!event.native) {
    switch (event.chain_type) {
      case "cosmos": {
        await setCosmosNetwork();
        break;
      }
      case "evm": {
        await setEvmNetwork();
        await connectEvm();
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
    isDisabled.value = true;
    amountErrorMsg.value = "";

    const isValid = validateAmount();

    if (isValid) {
      route = await getRoute();
      await onSwap();
    }
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
  } finally {
    isDisabled.value = false;
  }
}

function setNativeNetwork() {
  amountErrorMsg.value = "";
  route = null;

  networkCurrencies.value = walletStore.currencies;
  selectedCurrency.value = 0;
}

async function onSubmitEvm() {
  try {
    isDisabled.value = true;
    amountErrorMsg.value = "";

    const isValid = validateAmount();

    if (evmAddress.value.length == 0) {
      return false;
    }

    if (isValid) {
      route = await getRoute();
      await onSwap();
    }
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
  } finally {
    isDisabled.value = false;
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
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[network.value.key].currencies;
  for (const c of data ?? []) {
    if (c.visible) {
      if (app.protocolFilter == c.visible) {
        const currency = AssetUtils.getCurrencyByDenom(c.from);
        const balance = walletStore.balances.find((item) => item.balance.denom == c.from);
        currency.balance = coin(balance?.balance?.amount.toString() ?? 0, c.to);
        currencies.push(currency);
      }
    } else {
      const currency = AssetUtils.getCurrencyByDenom(c.from);
      const balance = walletStore.balances.find((item) => item.balance.denom == c.from);
      currency.balance = coin(balance?.balance?.amount.toString() ?? 0, c.to);
      currencies.push(currency);
    }
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

async function setEvmNetwork() {
  networkCurrencies.value = [];
  amount.value = "";
  amountErrorMsg.value = "";

  disablePicker.value = true;

  const currencies = [];
  const data = (skipRouteConfig as SkipRouteConfigType)?.transfers?.[network.value.key].currencies;

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

  switch (network.value.chain_type) {
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
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function onSwapNative() {
  try {
    isDisabled.value = true;
    await walletOperation(transferAmount);
  } catch (error: Error | any) {
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
        url: null
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
        if (walletStore.history[id]) {
          walletStore.history[id].historyData.errorMsg = amountErrorMsg.value;
          walletStore.history[id].historyData.status = CONFIRM_STEP.ERROR;
        }
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

    walletStore.loadActivities();
    onClose();
  } catch (e: Error | any) {
    amountErrorMsg.value = e.toString();
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
        await walletStore.UPDATE_BALANCES();

        walletStore.loadActivities();

        step.value = CONFIRM_STEP.SUCCESS;
        walletStore.history[id].historyData.route.activeStep = walletStore.history[id].historyData.route.steps.length;
        walletStore.history[id].historyData.routeDetails.activeStep =
          walletStore.history[id].historyData.routeDetails.steps.length;
        walletStore.history[id].historyData.status = CONFIRM_STEP.SUCCESS;

        onClose();
      } catch (error) {
        step.value = CONFIRM_STEP.ERROR;
        amountErrorMsg.value = (error as Error).toString();
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

async function submit(wallets: { [key: string]: BaseWallet | MetaMaskWallet }) {
  await SkipRouter.submitRoute(route!, wallets, async (tx: IObjectKeys, wallet: BaseWallet, chainId: string) => {
    walletStore.history[id].historyData.route.activeStep++;
    walletStore.history[id].historyData.routeDetails.activeStep++;

    switch (wallet.constructor) {
      case MetaMaskWallet: {
        const element = {
          hash: tx.hash,
          status: SwapStatus.pending,
          url: wallet.explorer
        };

        txHashes.value.push(element);

        if (walletStore.history[id]) {
          walletStore.history[id].historyData.txHashes = txHashes.value;
        }

        await SkipRouter.track(chainId, (tx as IObjectKeys).hash);
        await SkipRouter.fetchStatus((tx as IObjectKeys).hash, chainId);
        element.status = SwapStatus.success;

        break;
      }
      default: {
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

  const chainToParse: { [key: string]: IObjectKeys } = getChains(route!);
  const promises = [];
  for (const chain in chainToParse) {
    const fn = async function () {
      switch (chainToParse[chain].chain_type) {
        case "cosmos": {
          if (chain != NATIVE_NETWORK.key) {
            const client = await WalletUtils.getWallet(chain);
            const network = NETWORK_DATA;
            const networkData = network?.supportedNetworks[chain];
            const baseWallet = (await externalWallet(client, networkData)) as BaseWallet;
            const chainId = await baseWallet.getChainId();
            addrs[chainId] = baseWallet;
          }
          break;
        }
        case "evm": {
          const net = network.value as EvmNetwork;
          const client = new MetaMaskWallet(net.explorer);
          const endpoint = await AppUtils.fetchEvmEndpoints(net.key);
          const chainId = await client.getChainId(endpoint.rpc);

          await client.connect(
            {
              chainId: chainId,
              chainName: net.label,
              rpcUrls: [endpoint.rpc],
              blockExplorerUrls: [net.explorer],
              nativeCurrency: { ...net.nativeCurrency }
            },
            () => {}
          );
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
  let chainId = await client.getChainId();
  const asset = assets.value[selectedCurrency.value];

  const transferAmount = Decimal.fromUserInput(amount.value, asset!.decimal_digits as number);
  const options: IObjectKeys = {};

  switch (network.value.chain_type) {
    case "evm": {
      chainId = Number(chainId).toString();
      break;
    }
  }

  switch (walletStore.wallet?.signer?.type) {
    case WalletTypes.evm: {
      options.allow_multi_tx = false;
      options.smart_swap_options = {
        split_routes: false, // if you ALSO want to avoid split swaps, set this to false
        evm_swaps: true
      };
      break;
    }
  }

  const route = await SkipRouter.getRoute(
    asset.from!,
    asset.balance.denom,
    transferAmount.atomics,
    false,
    undefined,
    chainId,
    options
  );

  return route;
}

async function connectEvm() {
  try {
    destroyClient();
    isMetamaskLoading.value = true;

    const net = network.value as EvmNetwork;
    client = new MetaMaskWallet(net.explorer);

    const endpoint = await AppUtils.fetchEvmEndpoints(net.key);
    const chainId = await client.getChainId(endpoint.rpc);
    await client.connect(
      {
        chainId: chainId,
        chainName: net.label,
        rpcUrls: [endpoint.rpc],
        blockExplorerUrls: [net.explorer],
        nativeCurrency: { ...net.nativeCurrency }
      },
      () => {
        evmAddress.value = (client as MetaMaskWallet).shortAddress;
        wallet.value = (client as MetaMaskWallet).address;
      }
    );
    evmAddress.value = client.shortAddress;
    wallet.value = client.address;
    await setEvmNetwork();
  } catch (error: Error | any) {
    Logger.error(error);
    amountErrorMsg.value = error?.message ?? "";
  } finally {
    isMetamaskLoading.value = false;
  }
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

  for (const chain of chains) {
    for (const key in SUPPORTED_NETWORKS_DATA) {
      if (SUPPORTED_NETWORKS_DATA[key].value == chain.chain_name.toLowerCase()) {
        chainToParse[key] = SUPPORTED_NETWORKS_DATA[key];
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

  for (const chain of chains) {
    for (const key in SUPPORTED_NETWORKS_DATA) {
      if (SUPPORTED_NETWORKS_DATA[key].value == chain.chain_name.toLowerCase()) {
        chainToParse[chain.chain_id] = SUPPORTED_NETWORKS_DATA[key];
      }
    }
  }

  return chainToParse;
}
</script>
