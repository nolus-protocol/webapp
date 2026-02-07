<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.position-summary')"
      :icon="{ name: 'bar-chart', class: 'fill-icon-link' }"
    />

    <EmptyState
      v-if="status == TEMPLATES.opening"
      :slider="[
        {
          image: { name: 'position-summary' },
          title: $t('message.position-summary-lease'),
          description: $t('message.position-summary-lease-description'),
          link: {
            label: $t('message.learn-more-leases'),
            url: `/${RouteNames.LEASES}/${route.params.id}/learn-summary`,
            tooltip: { content: $t('message.learn-more-leases-tooltip') }
          }
        }
      ]"
    />

    <div
      v-else
      class="!md:flex-col flex flex-col-reverse gap-6 md:flex-row md:gap-10"
    >
      <div class="flex flex-col gap-3">
        <BigNumber
          :loading="loading"
          loadingWidth="200px"
          :label="$t('message.lease-size')"
          :amount="{
            amount: amount,
            type: CURRENCY_VIEW_TYPES.TOKEN,
            denom: asset?.shortName ?? '',
            decimals: assetLoan?.decimal_digits ?? 0,
            hasSpace: true,
            fontSize: mobile ? 24 : 32,
            animatedReveal: true,
            compact: mobile
          }"
          :secondary="stable"
        />
        <div class="flex flex-col gap-8 md:flex-row">
          <div class="flex flex-col gap-4">
            <BigNumber
              :loading="loading"
              :label="$t('message.outstanding-loan')"
              :label-tooltip="{ content: $t('message.outstanding-loan-tooltip') }"
              :amount="{
                amount: debt,
                type: CURRENCY_VIEW_TYPES.TOKEN,
                denom: lpn?.shortName ?? '',
                decimals: lpn?.decimal_digits ?? 0,
                hasSpace: true,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="`${$t('message.price-per-asset')} ${pricerPerAsset?.shortName}`"
              :amount="{
                amount: openedPrice,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                decimals: openedPriceDecimals,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="$t('message.partial-liquidation')"
              :label-tooltip="{ content: $t('message.partial-liquidation-tooltip') }"
              :amount="{
                amount: liquidation,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: `${NATIVE_CURRENCY.symbol}`,
                decimals: liquidationDecimals,
                fontSize: 16
              }"
            />
            <BigNumber
              :loading="loading"
              :label="$t('message.interest-due')"
              :label-tooltip="{ content: $t('message.repay-interest', { dueDate: interestDueDate }) }"
              :amount="{
                amount: interestDue,
                type: CURRENCY_VIEW_TYPES.TOKEN,
                denom: lpn?.shortName ?? '',
                decimals: lpn?.decimal_digits ?? 0,
                hasSpace: true,
                fontSize: 16,
                class: interestDueStatus ? 'text-warning-100' : ''
              }"
            />
          </div>
          <div class="flex flex-col gap-4">
            <BigNumber
              :loading="loading"
              :label="$t('message.down-payment')"
              :label-tooltip="{ content: $t('message.downpayment-tooltip') }"
              :amount="{
                amount: downPayment,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                hasSpace: false,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="$t('message.impact-dex-fee')"
              :label-tooltip="{ content: $t('message.impact-dex-fee-tooltip') }"
              :amount="{
                amount: fee,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                fontSize: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="$t('message.interest-fee')"
              :label-tooltip="{ content: $t('message.interest-fee-tooltip') }"
              :amount="{
                amount: interest,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: '%',
                isDenomInfront: false,
                fontSize: 16
              }"
            />
          </div>
        </div>
      </div>
      <span class="border-b border-border-color md:block md:border-r" />
      <div class="flex flex-1 flex-col gap-4">
        <BigNumber
          :loading="loading"
          :loading-width="'120px'"
          :label="$t('message.unrealized-pnl')"
          :amount="{
            amount: pnl.amount.toString(2),
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: '$',
            class: pnl.status ? 'text-typography-success' : 'text-typography-error',
            fontSize: mobile ? 24 : 32,
            animatedReveal: true,
            compact: mobile
          }"
          :pnl-status="{
            positive: pnl.status,
            value: `${pnl.status ? '+' : ''}${pnl.percent}%`,
            badge: {
              content: pnl.percent,
              base: false
            }
          }"
        />
        <div class="flex gap-8">
          <div class="flex flex-col gap-2">
            <span class="flex items-center gap-1">
              {{ $t("message.stop-loss-price") }}
              <Tooltip :content="$t('message.stop-loss-price-tooltip')">
                <SvgIcon
                  name="help"
                  class="rouded-full"
                  size="s"
                /> </Tooltip
            ></span>
            <template v-if="stopLoss">
              <span class="flex text-14 font-semibold text-typography-default">
                {{ stopLoss.amount }} {{ $t("message.per") }} {{ asset?.shortName }}
              </span>
            </template>
            <div class="flex">
              <Button
                class="flex-1"
                :label="stopLoss ? $t('message.edit') : $t('message.set-stop-loss')"
                severity="secondary"
                size="small"
                :disabled="loading"
                @click="
                  router.push({
                    path: `/${RouteNames.LEASES}/${lease?.address}/${SingleLeaseDialog.STOP_LOSS}`
                  })
                "
              />
              <Button
                v-if="stopLoss"
                severity="secondary"
                icon="trash"
                size="small"
                class="ml-2 text-icon-default"
                :disabled="loading"
                :loading="loadingStopLoss"
                @click="onRemoveStopLoss"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="flex items-center gap-1">
              {{ $t("message.take-profit-price") }}
              <Tooltip :content="$t('message.take-profit-price-tooltip')">
                <SvgIcon
                  name="help"
                  class="rouded-full"
                  size="s"
                /> </Tooltip
            ></span>
            <template v-if="takeProfit">
              <span class="flex text-14 font-semibold text-typography-default">
                {{ takeProfit.amount }} {{ $t("message.per") }} {{ asset?.shortName }}
              </span>
            </template>
            <div class="flex">
              <Button
                class="flex-1"
                :label="takeProfit ? $t('message.edit') : $t('message.set-take-profit')"
                severity="secondary"
                size="small"
                :disabled="loading"
                @click="
                  router.push({
                    path: `/${RouteNames.LEASES}/${lease?.address}/${SingleLeaseDialog.TAKE_PROFIT}`
                  })
                "
              />
              <Button
                v-if="takeProfit"
                severity="secondary"
                icon="trash"
                size="small"
                class="ml-2 text-icon-default"
                :disabled="loading"
                :loading="loadingTakeProfit"
                @click="onRemoveTakeProfit"
              />
            </div>
          </div>
        </div>
        <hr class="border-t border-border-color" />
        <PnlOverTimeChart :lease="lease" />
      </div>
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import { Button, SvgIcon, ToastType, Tooltip, Widget } from "web-components";

import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { RouteNames } from "@/router";

import EmptyState from "@/common/components/EmptyState.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import PnlOverTimeChart from "./PnlOverTimeChart.vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { computed, inject, ref, watch } from "vue";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useHistoryStore } from "@/common/stores/history";
import { Dec } from "@keplr-wallet/unit";
import { formatNumber, formatPriceDec, getAdaptivePriceDecimals } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker, getCurrencyByDenom, getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { dateParser, isMobile, Logger, walletOperation } from "@/common/utils";
import { useRoute, useRouter } from "vue-router";
import { SingleLeaseDialog } from "@/modules/leases/enums";
import { TEMPLATES } from "../common";
import { useWalletStore } from "@/common/stores/wallet";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { useI18n } from "vue-i18n";
import type { CurrencyComponentProps } from "@/common/components/CurrencyComponent.vue";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";

const mobile = isMobile();

const props = defineProps<{
  lease?: LeaseInfo | null;
  displayData?: LeaseDisplayData | null;
  loading: boolean;
}>();

const configStore = useConfigStore();
const pricesStore = usePricesStore();
const historyStore = useHistoryStore();
const router = useRouter();
const walletStore = useWalletStore();
const loadingStopLoss = ref(false);
const loadingTakeProfit = ref(false);
const i18n = useI18n();
const route = useRoute();
const reload = inject("reload", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const pnl = computed(() => {
  if (!props.displayData) {
    return { percent: "0.00", amount: "0.00", status: true, neutral: true };
  }
  return {
    percent: props.displayData.pnlPercent.toString(2),
    amount: props.displayData.pnlAmount.toString(2),
    status: props.displayData.pnlPositive,
    neutral: false
  };
});

const status = computed(() => {
  if (!props.lease) return TEMPLATES.opening;
  switch (props.lease.status) {
    case "opening":
      return TEMPLATES.opening;
    case "opened":
      return TEMPLATES.opened;
    case "paid_off":
      return TEMPLATES.paid;
    case "closing":
      return TEMPLATES.paid;
    case "closed":
      return TEMPLATES.closed;
    case "liquidated":
      return TEMPLATES.liquidated;
    default:
      return TEMPLATES.opening;
  }
});

const amount = computed(() => {
  return props.lease?.amount?.amount ?? "0";
});

const assetLoan = computed(() => {
  const posType = props.displayData?.positionType;
  if (posType === "long") {
    return asset.value;
  } else if (posType === "short") {
    // For short positions, use LPN
    const lpnCurrency = lpn.value;
    return lpnCurrency ?? asset.value;
  }
  return asset.value;
});

const pricerPerAsset = computed(() => {
  const posType = props.displayData?.positionType;
  if (posType === "long") {
    return asset.value;
  } else if (posType === "short") {
    const p = props.lease?.protocol!;
    const ticker = props.lease?.etl_data?.lease_position_ticker;
    const currency = configStore.currenciesData![`${ticker}@${p}`];
    return currency;
  }
  return asset.value;
});

const stopLoss = computed(() => {
  return props.displayData?.stopLoss
    ? {
        percent: props.displayData.stopLoss.percent,
        amount: formatNumber(props.displayData.stopLoss.price.toString(asset.value?.decimal_digits), asset.value?.decimal_digits, NATIVE_CURRENCY.symbol)
      }
    : null;
});

const takeProfit = computed(() => {
  return props.displayData?.takeProfit
    ? {
        percent: props.displayData.takeProfit.percent,
        amount: formatNumber(props.displayData.takeProfit.price.toString(asset.value?.decimal_digits), asset.value?.decimal_digits, NATIVE_CURRENCY.symbol)
      }
    : null;
});

const asset = computed(() => {
  if (!props.lease) return undefined;
  const ticker = props.lease.amount.ticker;
  const protocol = props.lease.protocol;
  const item = getCurrencyByTicker(ticker);
  return item ? getCurrencyByDenom(item.ibcData as string) : undefined;
});

const stable = computed<CurrencyComponentProps>(() => {
  const dflt = {
    amount: "0",
    type: CURRENCY_VIEW_TYPES.CURRENCY,
    denom: NATIVE_CURRENCY.symbol,
    fontSize: 16
  } as CurrencyComponentProps;

  if (!props.lease || !props.displayData) {
    return dflt;
  }

  const posType = props.displayData.positionType;
  const assetAmount = new Dec(props.lease.amount.amount, assetLoan.value?.decimal_digits ?? 0);

  if (posType === "long") {
    const ticker = props.lease.amount.ticker;
    const protocol = props.lease.protocol;
    const price = pricesStore.prices[`${ticker}@${protocol}`];
    const value = assetAmount.mul(new Dec(price?.price ?? "0"));

    return {
      amount: value.toString(NATIVE_CURRENCY.maximumFractionDigits),
      type: CURRENCY_VIEW_TYPES.CURRENCY,
      denom: NATIVE_CURRENCY.symbol,
      fontSize: 16
    } as CurrencyComponentProps;
  } else if (posType === "short") {
    const ticker = props.lease.etl_data?.lease_position_ticker ?? props.lease.amount.ticker;
    const protocol = props.lease.protocol;
    const ast = configStore.currenciesData?.[`${ticker}@${protocol}`];
    const price = pricesStore.prices[ast?.key as string];
    const value = assetAmount.quo(new Dec(price?.price ?? "1"));
    return {
      amount: value.toString(NATIVE_CURRENCY.maximumFractionDigits),
      type: CURRENCY_VIEW_TYPES.TOKEN,
      denom: ast?.shortName,
      decimals: asset.value?.decimal_digits,
      fontSize: 16,
      hasSpace: true
    } as CurrencyComponentProps;
  }

  return dflt;
});

const lpn = computed(() => {
  if (props.lease) {
    return getLpnByProtocol(props.lease.protocol);
  }
  return undefined;
});

const debt = computed(() => {
  if (props.lease && lpn.value) {
    const totalDebt = props.displayData?.totalDebt ?? new Dec(0);
    return totalDebt.toString(lpn.value.decimal_digits);
  }
  return "0";
});

const downPayment = computed(() => {
  if (props.displayData) {
    const amount = props.displayData.downPayment.add(props.displayData.repaymentValue);
    return amount.toString(NATIVE_CURRENCY.maximumFractionDigits);
  }
  return "0";
});

const fee = computed(() => {
  if (props.displayData) {
    return props.displayData.fee.toString(NATIVE_CURRENCY.maximumFractionDigits);
  }
  return "0";
});

const openedPrice = computed(() => {
  if (props.displayData) {
    return formatPriceDec(props.displayData.openingPrice);
  }
  return "0";
});

const openedPriceDecimals = computed(() => {
  return getAdaptivePriceDecimals(Number(props.displayData?.openingPrice.toString(8) ?? 0));
});

const interestDue = computed(() => {
  if (props.displayData && props.lease?.status === "opened") {
    return props.displayData.interestDue.toString(lpn.value?.decimal_digits ?? 6);
  }
  return "0";
});

const interestDueStatus = computed(() => {
  return props.displayData?.interestDueWarning ?? false;
});

const interest = computed(() => {
  if (props.displayData) {
    return props.displayData.interestRateMonthly.toString(2);
  }
  return "0.00";
});

const liquidation = computed(() => {
  if (props.displayData && props.lease?.status === "opened") {
    return formatPriceDec(props.displayData.liquidationPrice);
  }
  return "0";
});

const liquidationDecimals = computed(() => {
  return getAdaptivePriceDecimals(Number(props.displayData?.liquidationPrice.toString(8) ?? 0));
});

const interestDueDate = computed(() => {
  if (props.displayData?.interestDueDate) {
    return dateParser(props.displayData.interestDueDate.toISOString(), true);
  }
  return dateParser(new Date().toISOString(), true);
});

async function onRemoveStopLoss() {
  try {
    await walletOperation(onSetStopLoss);
  } catch (error: Error | any) {}
}

async function onSetStopLoss() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && props.lease) {
    try {
      loadingStopLoss.value = true;

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, props.lease.address);

      const takeProfitValue = props.lease.close_policy?.take_profit;
      const { txBytes } = await leaseClient.simulateChangeClosePolicyTx(wallet, null, takeProfitValue);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      historyStore.loadActivities();
      reload();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.stop-loss-toast")
      });
    } catch (error: Error | any) {
      Logger.error(error);
    } finally {
      loadingStopLoss.value = false;
    }
  }
}

async function onRemoveTakeProfit() {
  try {
    await walletOperation(onSetTakeProfit);
  } catch (error: Error | any) {}
}

async function onSetTakeProfit() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet && props.lease) {
    try {
      loadingTakeProfit.value = true;

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, props.lease.address);

      const stopLossValue = props.lease.close_policy?.stop_loss;
      const { txBytes } = await leaseClient.simulateChangeClosePolicyTx(wallet, stopLossValue, null);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      historyStore.loadActivities();
      reload();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.stop-loss-toast")
      });
    } catch (error: Error | any) {
      Logger.error(error);
    } finally {
      loadingTakeProfit.value = false;
    }
  }
}
</script>
