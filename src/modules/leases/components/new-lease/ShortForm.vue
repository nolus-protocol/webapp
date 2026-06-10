<template>
  <div
    class="flex w-full flex-1 flex-col self-start rounded-xl border border-border-default bg-neutral-bg-2 shadow-larger"
  >
    <div class="flex gap-px rounded-tl-xl rounded-tr-xl bg-border-default">
      <Radio
        v-for="(tab, index) in tabs"
        :key="index"
        :id="`tab-${index}`"
        ref="radioRefs"
        :class="[
          {
            'border-transparent bg-neutral-bg-2': activeTabIdx === index,
            'border-border-default': activeTabIdx !== index,
            'bg-neutral-bg-2': activeTabIdx === index,
            'rounded-tl-xl': index === 0,
            'rounded-tr-xl': index === tabs.length - 1
          }
        ]"
        :label="$t(`message.${tab.action}`)"
        :checked="activeTabIdx == index"
        class="flex flex-1 cursor-pointer justify-center border-b bg-neutral-bg-1 px-6 py-5 text-16 font-normal text-typography-default"
        name="dialogTabsGroup"
        @click="handleParentClick(index)"
      />
    </div>

    <AdvancedFormControl
      searchable
      id="receive-send"
      :currencyOptions="assets"
      class="px-6 pt-4"
      :label="$t('message.down-payment-uppercase')"
      :balanceLabel="$t('message.balance')"
      placeholder="0"
      :calculated-balance="calculatedBalance"
      :disabled-currency-picker="isLoading"
      :disabled-input-field="isLoading"
      @on-selected-currency="
        (option: any) => {
          selectedCurrency = assets.findIndex((item) => item == option);
          selectedLoanCurrency = 0;
        }
      "
      @input="handleAmountChange"
      :error-msg="amountErrorMsg"
      v-bind="advancedControlBindings"
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
    <hr class="my-4 border-border-color" />
    <div class="flex max-w-[190px] flex-col gap-2 px-6">
      <label
        for="dropdown-btn-asset-to-lease"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.asset-to-lease-short") }}</label
      >
      <Dropdown
        id="asset-to-lease"
        :on-select="
          (data) => {
            selectedLoanCurrency = coinList.findIndex((item) => item == data);
          }
        "
        :options="coinList"
        :size="Size.medium"
        v-bind="selectedLoanOption !== undefined ? { selected: selectedLoanOption } : {}"
        searchable
        :disabled="isLoading"
      />
    </div>
    <hr class="my-4 border-border-color" />
    <div class="flex flex-col gap-2 px-6">
      <label
        for="position-size"
        class="flex w-fit items-center text-16 font-semibold text-typography-default"
        >{{ $t("message.position-size") }}
      </label>
      <div class="px-[18px] py-3">
        <Slider
          :disabled="isLoading"
          :min-position="MIN_POSITION"
          :max-position="MAX_POSITION"
          :positions="POSITIONS"
          @on-drag="onDrag"
          class="relative"
        />
      </div>
    </div>
    <hr class="my-4 border-border-color" />

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
            label: $t('message.open-position'),
            icon: NATIVE_NETWORK.icon,
            meta: () => h('div', `${NATIVE_NETWORK.label}`)
          },
          {
            label: $t('message.stepper-transfer-position'),
            icon: getIconByProtocol()!,
            token: {
              balance: formatTokenBalance(stepperTransfer),
              symbol: assets[selectedCurrency]?.label
            },
            meta: () => h('div', `${NATIVE_NETWORK.label} > ${protocolName}`)
          },
          {
            label: $t('message.swap'),
            icon: getIconByProtocol()!,
            tokenComponent: () => h('div', swapAmount),
            meta: () => h('div', `${protocolName} > ${NATIVE_NETWORK.label}`)
          }
        ]"
        :variant="StepperVariant.MEDIUM"
      />
    </div>
    <hr class="my-4 border-border-color" /> -->
    <div class="flex flex-col gap-2 p-6">
      <Button
        size="large"
        severity="primary"
        :label="$t('message.open-position')"
        @click="onOpenLease()"
        :loading="isLoading"
        :disabled="isDisabled"
      />
      <p class="text-center text-12 text-typography-secondary">
        {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseOpenEstimation }}{{ $t("message.min") }}
      </p>
    </div>
  </div>
  <ShortLeaseDetails
    :downpaymen-amount="amount"
    :downpayment-currency="currency?.key ?? ''"
    :lease="leaseApply"
    :loan-currency="selectedLoanOption?.key ?? ''"
  />
</template>

<script lang="ts" setup>
import { computed, inject, watch } from "vue";
import {
  AdvancedFormControl,
  Button,
  Dropdown,
  Radio,
  Slider,
  Size,
  type AssetItemProps,
  AssetItem,
  ToastType
} from "web-components";
import { RouteNames } from "@/router";
import { tabs } from "../types";

import ShortLeaseDetails from "@/modules/leases/components/new-lease/ShortLeaseDetails.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useHistoryStore } from "@/common/stores/history";
import { classifyError, getMicroAmount, Logger, walletOperation } from "@/common/utils";
import { formatDecAsUsd, formatUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency } from "@/common/types";
import { INTEREST_DECIMALS, MAX_POSITION, MIN_POSITION, POSITIONS, SORT_LEASE, WASM_EVENTS } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { h } from "vue";
import { useI18n } from "vue-i18n";
import type { NolusWallet } from "@nolus/nolusjs";
import { NolusClient } from "@nolus/nolusjs";
import { Leaser } from "@nolus/nolusjs/build/contracts";
import { useRouter } from "vue-router";
import { useLeaseOpen } from "./useLeaseOpen";

const activeTabIdx = 1;
const walletStore = useWalletStore();
const balancesStore = useBalancesStore();
const configStore = useConfigStore();
const pricesStore = usePricesStore();
const historyStore = useHistoryStore();
const i18n = useI18n();
const router = useRouter();
const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});
const reload = inject("reload", () => {});

const {
  selectedCurrency,
  selectedLoanCurrency,
  isLoading,
  isDisabled,
  amount,
  amountErrorMsg,
  ltd,
  leaseApply,
  errorInsufficientBalance,
  handleAmountChange,
  handleParentClick,
  onDrag,
  validateMinMaxValues,
  validateAmountAgainstBalance,
  isDownPaymentAmountValid
} = useLeaseOpen();

watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized) {
      void onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  // Free interest is handled by a 3rd party service
  // Asset filtering (ignore_short) is now done by the backend in /api/protocols/{protocol}/currencies
}

watch(
  () => [selectedCurrency.value, amount.value, selectedLoanCurrency.value, ltd.value],
  async () => {
    amountErrorMsg.value = "";
    if (!validateAmountAgainstBalance(currency.value)) {
      leaseApply.value = null;
      return;
    }
    if (await validateMinMaxValues(currency.value, coinList.value[selectedLoanCurrency.value])) {
      void calculate();
    } else {
      leaseApply.value = null;
    }
  }
);

const totalBalances = computed(() => {
  const currencies: ExternalCurrency[] = [];
  const b = balancesStore.balances;
  const seenDenoms = new Set<string>();

  // Use short protocols from gated protocols API
  const shortProtocols = configStore.shortProtocolsForCurrentNetwork;

  for (const protocol of shortProtocols) {
    // Get cached currencies for this protocol
    const protocolCurrencies = configStore.getCachedProtocolCurrencies(protocol.protocol);

    for (const currency of protocolCurrencies) {
      // Find matching currency in currenciesData to get full info
      const key = `${currency.ticker}@${protocol.protocol}`;
      const currencyInfo = configStore.currenciesData?.[key];

      if (currencyInfo) {
        const balance = b.find((bal) => bal.denom === currencyInfo.ibcData);
        // Deduplicate by denom
        if (balance && !seenDenoms.has(balance.denom)) {
          seenDenoms.add(balance.denom);
          currencies.push({ ...currencyInfo, balance: balance } as ExternalCurrency);
        } else if (!balance && !seenDenoms.has(currencyInfo.ibcData)) {
          seenDenoms.add(currencyInfo.ibcData);
          currencies.push({
            ...currencyInfo,
            balance: { denom: currencyInfo.ibcData, amount: "0" }
          } as ExternalCurrency);
        }
      }
    }
  }

  return currencies;
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const selectedLoanOption = computed(() => {
  return coinList.value[selectedLoanCurrency.value];
});

const advancedControlBindings = computed(() => {
  return {
    ...(errorInsufficientBalance.value ? { inputClass: "text-typography-error" } : {}),
    ...(currency.value !== undefined ? { selectedCurrencyOption: currency.value } : {})
  };
});

const assets = computed(() => {
  // Backend already filters out ignored assets in /api/protocols/{protocol}/currencies
  const data = [];

  for (const asset of (totalBalances.value as ExternalCurrency[]) ?? []) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = formatTokenBalance(value);
    const exactBalance = value.isZero() ? "0" : value.toString(asset.decimal_digits).replace(/\.?0+$/, "");
    const denom = asset.ibcData;
    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
    const stable = price.mul(value);

    data.push({
      name: asset.name,
      value: denom,
      label: asset.shortName,
      shortName: asset.shortName,
      icon: asset.icon,
      decimal_digits: asset.decimal_digits,
      balance: {
        value: exactBalance,
        customLabel: `${balance} ${asset.shortName}`,
        ticker: asset.shortName,
        denom: asset.balance?.denom,
        amount: asset.balance?.amount
      },
      ibcData: (asset as ExternalCurrency).ibcData,
      native: asset.native,
      symbol: asset.symbol,
      ticker: asset.ticker,
      key: asset.key,
      stable,
      price: formatDecAsUsd(stable)
    });
  }

  return data.sort((a, b) => {
    return Number(b.stable.sub(a.stable).toString(8));
  });
});

const coinList = computed(() => {
  // For short positions, the "coin to lease" is determined by the short protocols
  // Each short protocol represents an asset that can be shorted
  // Backend already filters out ignored assets based on lease-rules.json
  const shortProtocols = configStore.shortProtocolsForCurrentNetwork;

  const list = shortProtocols.map((protocol) => {
    // Get the LPN info from the protocol's lpn_display
    return {
      key: `${protocol.lpn}@${protocol.protocol}`,
      ticker: protocol.lpn,
      label: protocol.lpn_display?.shortName || protocol.lpn,
      value: protocol.lpn, // This will be used to find the currency
      icon: protocol.lpn_display?.icon || "",
      protocol: protocol.protocol
    };
  });

  const sortOrder = new Map(SORT_LEASE.map((t, i) => [t, i]));

  return list.sort((a, b) => {
    const aIndex = sortOrder.get(a.ticker);
    const bIndex = sortOrder.get(b.ticker);
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex !== undefined && bIndex === undefined) return -1;
    if (aIndex === undefined && bIndex !== undefined) return 1;
    return (aIndex as number) - (bIndex as number);
  });
});

const calculatedBalance = computed(() => {
  const asset = assets.value[selectedCurrency.value];
  if (!asset) {
    return formatUsd(0);
  }

  const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return formatDecAsUsd(stable);
});

// For a Short protocol the contract's `leaseTicker` is the stable currency the
// position is denominated in (e.g., USDC_NOBLE) — NOT the user's down payment.
// It's exposed in the protocol currencies list with group="lease" (the only one
// for a Short protocol; `group="lpn"` there is the borrowed asset).
async function resolveShortLeaseTicker(protocol: string): Promise<string> {
  const currencies = await configStore.getProtocolCurrencies(protocol);
  const stable = currencies.find((c) => c.group === "lease");
  if (!stable) {
    throw new Error(`Short protocol ${protocol} has no stable (group="lease") currency`);
  }
  return stable.ticker;
}

async function calculate() {
  try {
    const downPaymentAmount = amount.value;
    const selectedDownPaymentCurrency = currency.value;
    const loanCurrency = coinList.value[selectedLoanCurrency.value];
    if (downPaymentAmount) {
      if (selectedDownPaymentCurrency === undefined || loanCurrency === undefined) {
        throw new Error("down payment or lease currency is not selected");
      }
      const denom = selectedDownPaymentCurrency.balance.denom;
      if (denom === undefined) {
        throw new Error(`missing bank denom for ${selectedDownPaymentCurrency.key}`);
      }
      const microAmount = getMicroAmount(denom, downPaymentAmount);

      const currency = selectedDownPaymentCurrency;
      const [_c, protocol] = loanCurrency.key.split("@");

      const [downPaymentTicker, _p] = currency.key.split("@");
      if (protocol === undefined || downPaymentTicker === undefined) {
        throw new Error(`malformed currency key: ${currency.key} / ${loanCurrency.key}`);
      }
      const leaseTicker = await resolveShortLeaseTicker(protocol);

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

      const contracts = configStore.contracts[protocol];
      if (contracts === undefined || contracts.leaser === null) {
        throw new Error(`no leaser contract configured for protocol ${protocol}`);
      }
      const leaserClient = new Leaser(cosmWasmClient, contracts.leaser);

      const makeLeaseApplyResp = await leaserClient.leaseQuote(
        microAmount.mAmount.amount.toString(),
        downPaymentTicker,
        leaseTicker,
        ltd.value
      );

      makeLeaseApplyResp.annual_interest_rate =
        makeLeaseApplyResp.annual_interest_rate / Math.pow(10, INTEREST_DECIMALS);
      makeLeaseApplyResp.annual_interest_rate_margin =
        makeLeaseApplyResp.annual_interest_rate_margin / Math.pow(10, INTEREST_DECIMALS);

      leaseApply.value = makeLeaseApplyResp;
    } else {
      leaseApply.value = null;
    }
  } catch (error) {
    Logger.error("ShortForm calculate error:", error);
    amountErrorMsg.value = i18n.t(classifyError(error));
    leaseApply.value = null;
  }
}

async function onOpenLease() {
  try {
    isDisabled.value = true;
    await walletOperation(openLease);
  } catch (error: unknown) {
    amountErrorMsg.value = i18n.t(classifyError(error));
    Logger.error(error);
  } finally {
    isDisabled.value = false;
  }
}

async function openLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && (await isDownPaymentAmountValid(currency.value, coinList.value[selectedLoanCurrency.value]))) {
    try {
      isLoading.value = true;

      const selectedDownPaymentCurrency = currency.value;
      const downPayment = amount.value;
      const selectedCurrency = coinList.value[selectedLoanCurrency.value];

      if (selectedDownPaymentCurrency === undefined || selectedCurrency === undefined) {
        throw new Error("down payment or lease currency is not selected");
      }
      const denom = selectedDownPaymentCurrency.balance.denom;
      if (denom === undefined) {
        throw new Error(`missing bank denom for ${selectedDownPaymentCurrency.key}`);
      }
      const microAmount = getMicroAmount(denom, downPayment);

      const funds = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const configStore = useConfigStore();

      const [_borrowedTicker, protocol] = selectedCurrency.key.split("@");
      if (protocol === undefined) {
        throw new Error(`malformed lease currency key: ${selectedCurrency.key}`);
      }
      const leaseTicker = await resolveShortLeaseTicker(protocol);

      const contracts = configStore.contracts[protocol];
      if (contracts === undefined || contracts.leaser === null) {
        throw new Error(`no leaser contract configured for protocol ${protocol}`);
      }
      const leaserClient = new Leaser(cosmWasmClient, contracts.leaser);

      const {
        txHash: _txHash,
        txBytes,
        usedFee: _usedFee
      } = await leaserClient.simulateOpenLeaseTx(wallet, leaseTicker, ltd.value, funds);

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);

      const item = tx?.events.find((event) => {
        return event.type === WASM_EVENTS["wasm-ls-request-loan"].key;
      });

      const data = item?.attributes[WASM_EVENTS["wasm-ls-request-loan"].index];
      void balancesStore.fetchBalances();
      void historyStore.loadActivities();
      reload();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.currently-opening")
      });

      if (data === undefined) {
        throw new Error("wasm-ls-request-loan event attribute missing from the broadcast result");
      }
      void router.push(`/${RouteNames.LEASES}/${data.value}`);
    } catch (error: unknown) {
      amountErrorMsg.value = i18n.t(classifyError(error));
      Logger.error(error);
    } finally {
      isLoading.value = false;
    }
  }
}
</script>
