<template>
  <div
    class="flex w-full flex-1 flex-col self-start rounded-xl border border-border-default bg-neutral-bg-2 shadow-larger"
  >
    <div class="flex rounded-tl-xl rounded-tr-xl border-b border-border-color bg-neutral-bg-1">
      <Radio
        v-for="(tab, index) in tabs"
        :key="index"
        :id="`tab-${index}`"
        ref="radioRefs"
        :class="[
          {
            'bg-neutral-bg-2': activeTabIdx === index,
            'rounded-tl-xl': index === 0,
            'rounded-tr-xl': index === tabs.length - 1
          }
        ]"
        :label="$t(`message.${tab.action}`)"
        :checked="activeTabIdx == index"
        class="flex flex-1 cursor-pointer justify-center border-r border-border-color bg-neutral-bg-1 px-6 py-5 text-16 font-normal text-typography-default"
        name="dialogTabsGroup"
        @click="handleParentClick(index)"
        :disabled="!isShortEnabled"
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
      :selected-currency-option="currency"
    />
    <hr class="my-4 border-border-color" />
    <div class="flex max-w-[190px] flex-col gap-2 px-6">
      <label
        for="dropdown-btn-asset-to-lease"
        class="text-16 font-semibold text-typography-default"
        >{{ $t("message.asset-to-lease") }}</label
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
        :selected="coinList[selectedLoanCurrency]"
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
        :disabled="isDisabled || isProtocolDisabled"
      />
      <p class="text-center text-12 text-typography-secondary">
        {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.leaseOpenEstimation }}{{ $t("message.min") }}
      </p>
    </div>
  </div>
  <LongLeaseDetails
    :downpaymen-amount="amount"
    :downpayment-currency="currency?.key"
    :lease="leaseApply"
    :loan-currency="coinList[selectedLoanCurrency]?.key"
  />
</template>

<script lang="ts" setup>
import { computed, inject, ref, watch } from "vue";
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
import LongLeaseDetails from "@/modules/leases/components/new-lease/LongLeaseDetails.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useHistoryStore } from "@/common/stores/history";
import { getMicroAmount, Logger, walletOperation } from "@/common/utils";
import { formatDecAsUsd, formatUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { getDownpaymentRange } from "@/common/utils/LeaseConfigService";
import { NATIVE_NETWORK } from "../../../../config/global/network";
import type { ExternalCurrency, IObjectKeys } from "@/common/types";
import {
  INTEREST_DECIMALS,
  MAX_POSITION,
  MIN_POSITION,
  PERCENT,
  PERMILLE,
  POSITIONS,
  SORT_LEASE,
  WASM_EVENTS
} from "@/config/global";
import type { AssetBalance } from "@/common/stores/wallet/types";
import { Dec, Int } from "@keplr-wallet/unit";
import { h } from "vue";
import { useI18n } from "vue-i18n";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Leaser, type LeaseApply } from "@nolus/nolusjs/build/contracts";
import { useRouter } from "vue-router";

const activeTabIdx = 0;
const walletStore = useWalletStore();
const balancesStore = useBalancesStore();
const configStore = useConfigStore();
const pricesStore = usePricesStore();
const historyStore = useHistoryStore();
const i18n = useI18n();
const router = useRouter();

const selectedCurrency = ref(0);
const selectedLoanCurrency = ref(0);
const isLoading = ref(false);
const isDisabled = ref(false);
const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});
const reload = inject("reload", () => {});

const amount = ref("");
const amountErrorMsg = ref("");
const ltd = ref((MAX_POSITION / PERCENT) * PERMILLE);
const leaseApply = ref<LeaseApply | null>();

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
  // Free interest is handled by a 3rd party service
  // Asset filtering (ignore_long) is now done by the backend in /api/protocols/{protocol}/currencies
}

watch(
  () => [selectedCurrency.value, amount.value, selectedLoanCurrency.value, ltd.value],
  async () => {
    amountErrorMsg.value = "";
    if (await validateMinMaxValues()) {
      calculate();
    } else {
      leaseApply.value = null;
    }
  }
);

const totalBalances = computed(() => {
  const currencies: ExternalCurrency[] = [];
  // Use long protocols from gated protocols API
  const longProtocols = configStore.longProtocolsForCurrentNetwork;

  for (const protocol of longProtocols) {
    // Get cached currencies for this protocol
    const protocolCurrencies = configStore.getCachedProtocolCurrencies(protocol.protocol);

    for (const currency of protocolCurrencies) {
      // Find matching currency in currenciesData to get full info
      const key = `${currency.ticker}@${protocol.protocol}`;
      const currencyInfo = configStore.currenciesData?.[key];

      if (currencyInfo) {
        const balance = balancesStore.balances.find((b) => b.denom === currencyInfo.ibcData);
        currencies.push({ ...currencyInfo, balance: balance } as ExternalCurrency);
      }
    }
  }
  return currencies;
});

const isShortEnabled = computed(() => {
  // Use dynamic check from config store instead of hardcoded protocolsFilter
  return configStore.hasShortProtocols(configStore.protocolFilter);
});

const isProtocolDisabled = computed(() => {
  // Use dynamic check from config store instead of hardcoded protocolsFilter
  return configStore.isNetworkDisabled(configStore.protocolFilter);
});

const currency = computed(() => {
  return assets.value[selectedCurrency.value];
});

const assets = computed(() => {
  const data = [];
  // Use dynamic protocols from config store instead of hardcoded protocolsFilter.hold
  const activeProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);
  const b = ((balances.value as ExternalCurrency[]) ?? []).filter((item) => {
    const [_, p] = item.key.split("@");

    if (activeProtocols.includes(p)) {
      return true;
    }
    return false;
  });

  for (const asset of b) {
    const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
    const balance = formatTokenBalance(value);
    const denom = (asset as ExternalCurrency).ibcData ?? (asset as AssetBalance).from;
    const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
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
        denom: asset.balance?.denom,
        amount: asset.balance?.amount
      },
      ibcData: (asset as ExternalCurrency).ibcData,
      native: asset.native!,
      symbol: asset.symbol!,
      ticker: asset.ticker!,
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
  if (!currency.value?.key) {
    return [];
  }

  const [_ticker, downPaymentProtocol] = currency.value.key.split("@");

  // Get currencies for the selected protocol that can be leased (group === "lease")
  const protocolCurrencies = configStore.getCachedProtocolCurrencies(downPaymentProtocol);
  const leaseCurrencies = protocolCurrencies.filter((c) => c.group === "lease");

  // Backend already filters out ignored assets in /api/protocols/{protocol}/currencies
  const list = leaseCurrencies.map((item) => {
    return {
      decimal_digits: item.decimals,
      key: `${item.ticker}@${downPaymentProtocol}`,
      ticker: item.ticker,
      label: item.shortName,
      value: item.bank_symbol,
      icon: item.icon
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
  const price = new Dec(pricesStore.prices[asset.key!]?.price ?? 0);
  const v = amount?.value?.length ? amount?.value : "0";
  const stable = price.mul(new Dec(v));
  return formatDecAsUsd(stable);
});

const balances = computed(() => {
  // Backend already filters out ignored assets in /api/protocols/{protocol}/currencies
  return totalBalances.value.filter((item) => {
    if (!item.key) {
      return false;
    }

    const [ticker, protocol] = item.key?.split("@") ?? [];

    // Get protocol currencies from cache and check if this is valid collateral
    const protocolCurrencies = configStore.getCachedProtocolCurrencies(protocol);
    const currencyInfo = protocolCurrencies.find((c) => c.ticker === ticker);

    // Valid collateral: LPN, native, or lease currencies
    if (currencyInfo) {
      return currencyInfo.group === "lpn" || currencyInfo.group === "native" || currencyInfo.group === "lease";
    }

    return false;
  });
});

function handleAmountChange(event: string) {
  amount.value = event;
}

const handleParentClick = (index: number) => {
  const tab = tabs[index];
  router.push({ path: `/${RouteNames.LEASES}/open/${tab.action}` });
};

function onDrag(event: number) {
  const pos = new Dec(event / PERCENT);
  ltd.value = Number(pos.mul(new Dec(PERMILLE)).truncate().toString());
}

async function validateMinMaxValues(): Promise<boolean> {
  try {
    let isValid = true;
    const selectedDownPaymentCurrency = currency.value;
    const selectedCurrency = coinList.value[selectedLoanCurrency.value];

    const downPaymentAmount = amount.value;
    const currentBalance = selectedDownPaymentCurrency;

    const [c, p] = selectedCurrency.key.split("@");
    const range = (await getDownpaymentRange(p))[c];
    if (currentBalance) {
      if (downPaymentAmount || downPaymentAmount !== "") {
        const priceData = pricesStore.prices[selectedDownPaymentCurrency.key as string];
        const priceAmount = priceData?.price ?? "0";

        const max = new Dec(range?.max ?? 0);
        const min = new Dec(range?.min ?? 0);

        const leaseMax = max.quo(new Dec(priceAmount));
        const leaseMin = min.quo(new Dec(priceAmount));

        const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
          downPaymentAmount,
          currentBalance.ibcData,
          currentBalance.decimal_digits
        );
        const balance = CurrencyUtils.calculateBalance(
          priceAmount,
          downPaymentAmountInMinimalDenom,
          currentBalance.decimal_digits
        ).toDec();

        if (balance.lt(min)) {
          amountErrorMsg.value = i18n.t("message.lease-min-error", {
            minAmount: formatTokenBalance(leaseMin),
            maxAmount: formatTokenBalance(leaseMax),
            symbol: selectedDownPaymentCurrency.shortName
          });
          isValid = false;
        }

        if (balance.gt(max)) {
          amountErrorMsg.value = i18n.t("message.lease-max-error", {
            minAmount: formatTokenBalance(leaseMin),
            maxAmount: formatTokenBalance(leaseMax),
            symbol: selectedDownPaymentCurrency.shortName
          });
          isValid = false;
        }
      }
    }

    return isValid;
  } catch (error) {
    console.log(error);
    amountErrorMsg.value = i18n.t("message.integer-out-of-range");
    return false;
  }
}

function isDownPaymentAmountValid() {
  let isValid = true;
  amountErrorMsg.value = "";

  const selectedDownPaymentCurrency = currency.value;
  const downPaymentAmount = amount.value;

  if (downPaymentAmount || downPaymentAmount !== "") {
    const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
      downPaymentAmount,
      "",
      selectedDownPaymentCurrency.decimal_digits
    );

    const isLowerThanOrEqualsToZero = new Dec(downPaymentAmountInMinimalDenom.amount || "0").lte(new Dec(0));

    const isGreaterThanWalletBalance = new Int(downPaymentAmountInMinimalDenom.amount.toString() || "0").gt(
      new Int(selectedDownPaymentCurrency?.balance?.amount ?? "0")
    );

    if (isLowerThanOrEqualsToZero) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-low");
      isValid = false;
    }

    if (isGreaterThanWalletBalance) {
      amountErrorMsg.value = i18n.t("message.invalid-balance-big");
      isValid = false;
    }

    if (!validateMinMaxValues()) {
      isValid = false;
    }
  } else {
    amountErrorMsg.value = i18n.t("message.missing-amount");
    isValid = false;
  }

  return isValid;
}

async function calculate() {
  try {
    const selectedDownPaymentCurrency = currency.value;
    const selectedCurrency = coinList.value[selectedLoanCurrency.value];
    const downPayment = amount.value;

    if (downPayment) {
      const microAmount = getMicroAmount(selectedDownPaymentCurrency.balance.denom, downPayment);

      const lease = selectedCurrency;

      const [downPaymentTicker, protocol] = selectedDownPaymentCurrency.key.split("@");
      const [leaseTicker] = lease.key.split("@");

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(cosmWasmClient, configStore.contracts[protocol].leaser);

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
  } catch {
    amountErrorMsg.value = i18n.t("message.no-liquidity");
    leaseApply.value = null;
  }
}

async function onOpenLease() {
  try {
    isDisabled.value = true;
    await walletOperation(openLease);
  } catch (error: unknown) {
    amountErrorMsg.value = String(error);
    Logger.error(error);
  } finally {
    isDisabled.value = false;
  }
}

async function openLease() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && isDownPaymentAmountValid()) {
    try {
      isLoading.value = true;

      const selectedDownPaymentCurrency = currency.value;
      const downPayment = amount.value;
      const selectedCurrency = coinList.value[selectedLoanCurrency.value];

      const microAmount = getMicroAmount(selectedDownPaymentCurrency.balance.denom, downPayment);

      const funds = [
        {
          denom: microAmount.coinMinimalDenom,
          amount: microAmount.mAmount.amount.toString()
        }
      ];

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

      const [leaseTicker, protocol] = selectedCurrency.key.split("@");

      const leaserClient = new Leaser(cosmWasmClient, configStore.contracts[protocol].leaser);

      const { txBytes } = await leaserClient.simulateOpenLeaseTx(
        wallet,
        leaseTicker,
        ltd.value,
        funds
      );

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);

      const item = tx?.events.find((item: IObjectKeys) => {
        return item.type == WASM_EVENTS["wasm-ls-request-loan"].key;
      });

      const data = item?.attributes[WASM_EVENTS["wasm-ls-request-loan"].index];
      balancesStore.fetchBalances();
      historyStore.loadActivities();
      reload();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.currently-opening")
      });

      router.push(`/${RouteNames.LEASES}/${data.value}`);
    } catch (error: unknown) {
      amountErrorMsg.value = String(error);
      Logger.error(error);
    } finally {
      isLoading.value = false;
    }
  }
}


</script>
