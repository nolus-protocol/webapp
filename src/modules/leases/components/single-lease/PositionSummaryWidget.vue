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
            url: `/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/learn-summary`,
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
          :label="$t('message.lease-size')"
          :amount="{
            amount: amount,
            type: CURRENCY_VIEW_TYPES.TOKEN,
            denom: asset?.shortName ?? '',
            decimals: asset?.decimal_digits ?? 0,
            hasSpace: true,
            around: true
          }"
          :secondary="{
            amount: stable,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 16,
            fontSizeSmall: 16
          }"
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
                fontSize: 16,
                fontSizeSmall: 16
              }"
            />

            <BigNumber
              :loading="loading"
              :label="`${$t('message.price-per-asset')} ${asset?.shortName}`"
              :amount="{
                amount: currentPrice,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                decimals: MID_DECIMALS,
                fontSize: 16,
                fontSizeSmall: 16
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
                decimals: 4,
                fontSize: 16,
                fontSizeSmall: 16
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
                fontSizeSmall: 16
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
                fontSize: 16,
                fontSizeSmall: 16
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
                fontSize: 16,
                fontSizeSmall: 16
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
                fontSize: 16,
                fontSizeSmall: 16
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
            amount: pnl.amount.toString(),
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: '$'
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
                {{ NATIVE_CURRENCY.symbol }}{{ stopLoss.amount }} {{ $t("message.per") }} {{ asset?.shortName }}
              </span>
              <!-- <span class="flex text-12 text-typography-default">
                {{ $t("message.max-loss") }}: {{ stopLoss.percent }}%
              </span> -->
            </template>
            <div class="flex">
              <Button
                class="flex-1"
                :label="stopLoss ? $t('message.edit') : $t('message.set-stop-loss')"
                severity="secondary"
                size="small"
                @click="
                  router.push({
                    path: `/${RouteNames.LEASES}/${lease?.protocol?.toLowerCase()}/${lease?.leaseAddress}/${SingleLeaseDialog.STOP_LOSS}`
                  })
                "
              />
              <Button
                v-if="stopLoss"
                severity="secondary"
                icon="trash"
                size="small"
                class="ml-2 text-icon-default"
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
                {{ NATIVE_CURRENCY.symbol }}{{ takeProfit.amount }} {{ $t("message.per") }} {{ asset?.shortName }}
              </span>
              <!-- <span class="flex text-12 text-typography-default">
                {{ $t("message.max-profit") }}: {{ takeProfit.percent }}%
              </span> -->
            </template>
            <div class="flex">
              <Button
                class="flex-1"
                :label="takeProfit ? $t('message.edit') : $t('message.set-take-profit')"
                severity="secondary"
                size="small"
                @click="
                  router.push({
                    path: `/${RouteNames.LEASES}/${lease?.protocol?.toLowerCase()}/${lease?.leaseAddress}/${SingleLeaseDialog.TAKE_PROFIT}`
                  })
                "
              />
              <Button
                v-if="takeProfit"
                severity="secondary"
                icon="trash"
                size="small"
                class="ml-2 text-icon-default"
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

import { CURRENCY_VIEW_TYPES, type LeaseData } from "@/common/types";
import { RouteNames } from "@/router";

import EmptyState from "@/common/components/EmptyState.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import PnlOverTimeChart from "./PnlOverTimeChart.vue";
import { MID_DECIMALS, NATIVE_CURRENCY, PERCENT, PERMILLE, PositionTypes, ProtocolsConfig } from "@/config/global";
import { computed, inject, ref, watch } from "vue";
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { Dec } from "@keplr-wallet/unit";
import { AssetUtils } from "@/common/utils/AssetUtils";
import { CurrencyDemapping } from "@/config/currencies";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { datePraser, Logger, walletOperation } from "@/common/utils";
import { useRoute, useRouter } from "vue-router";
import { SingleLeaseDialog } from "@/modules/leases/enums";
import { getStatus, TEMPLATES } from "../common";
import { useWalletStore } from "@/common/stores/wallet";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  lease?: LeaseData;
  loading: boolean;
}>();

const app = useApplicationStore();
const oracle = useOracleStore();
const router = useRouter();
const walletStore = useWalletStore();
const loadingStopLoss = ref(false);
const loadingTakeProfit = ref(false);
const i18n = useI18n();
const route = useRoute();
const reload = inject("reload", () => {});
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const pnl = ref({
  percent: "0.00",
  amount: "0.00",
  status: true,
  neutral: true
});

watch(
  () => props.lease,
  () => {
    pnl.value = {
      percent: props.lease!.pnlPercent.toString(2),
      amount: props.lease!.pnlAmount.toString(),
      status: props.lease!.pnlAmount.isPositive() || props.lease!.pnlAmount.isZero(),
      neutral: false
    };
  }
);

const status = computed(() => {
  return getStatus(props.lease as LeaseData);
});

const amount = computed(() => {
  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      const data =
        props.lease!.leaseStatus?.opened?.amount ||
        props.lease!.leaseStatus.opening?.downpayment ||
        props.lease!.leaseStatus.paid?.amount;
      return data?.amount ?? "0";
    }
    case PositionTypes.short: {
      const data =
        props.lease!.leaseStatus?.opened?.amount ||
        props.lease!.leaseStatus.opening?.downpayment ||
        props.lease!.leaseStatus.paid?.amount;

      const asset = app.currenciesData?.[`${props.lease!.leaseData!.leasePositionTicker}@${props.lease!.protocol}`]!;
      const price = oracle.prices?.[asset?.ibcData as string];
      let k = new Dec(data?.amount ?? 0).quo(new Dec(price.amount)).toString();
      return k;
    }
    default: {
      return "0";
    }
  }
});

const stopLoss = computed(() => {
  const data = props.lease?.leaseStatus.opened?.close_policy.stop_loss;
  const price = getPrice()!;

  if (!!data && !!price) {
    switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
      case PositionTypes.long: {
        const p = props.lease.stableAsset.quo(new Dec(data).quo(new Dec(PERMILLE))).quo(props.lease.unitAsset);
        return {
          percent: data / (PERMILLE / PERCENT),
          amount: p.toString(asset.value?.decimal_digits)
        };
      }
      case PositionTypes.short: {
        const p = props.lease.unitAsset.mul(new Dec(data).quo(new Dec(PERMILLE))).quo(props.lease.stableAsset);
        return {
          percent: data / (PERMILLE / PERCENT),
          amount: p.toString(asset.value?.decimal_digits)
        };
      }
    }
  }

  return null;
});

const takeProfit = computed(() => {
  const data = props.lease?.leaseStatus.opened?.close_policy.take_profit;
  const price = getPrice()!;

  if (!!data && !!price) {
    switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
      case PositionTypes.long: {
        const p = props.lease.stableAsset.quo(new Dec(data).quo(new Dec(PERMILLE))).quo(props.lease.unitAsset);
        return {
          percent: data / (PERMILLE / PERCENT),
          amount: p.toString(asset.value?.decimal_digits)
        };
      }
      case PositionTypes.short: {
        const p = props.lease.unitAsset.mul(new Dec(data).quo(new Dec(PERMILLE))).quo(props.lease.stableAsset);
        return {
          percent: data / (PERMILLE / PERCENT),
          amount: p.toString(asset.value?.decimal_digits)
        };
      }
    }
  }

  return null;
});

function getPrice() {
  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      return props.lease?.leaseData?.price;
    }
    case PositionTypes.short: {
      return props.lease?.leaseData?.lpnPrice;
    }
  }

  return new Dec(0);
}

const asset = computed(() => {
  if (props.lease?.leaseStatus?.opening && props.lease?.leaseData) {
    const item = app.currenciesData?.[props.lease.leaseData?.leasePositionTicker as string];
    return item;
  }

  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      const ticker =
        props.lease?.leaseStatus?.opened?.amount.ticker ||
        props.lease?.leaseStatus?.paid?.amount.ticker ||
        props.lease?.leaseStatus?.opening?.downpayment.ticker;
      const item = AssetUtils.getCurrencyByTicker(ticker as string);

      const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
      return asset;
    }
    case PositionTypes.short: {
      const item = AssetUtils.getCurrencyByTicker(props.lease?.leaseData?.leasePositionTicker as string);

      const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
      return asset;
    }
  }
});

const stable = computed(() => {
  const lease = props.lease;

  if (!lease) {
    return "0.00";
  }

  const amount =
    lease.leaseStatus?.opened?.amount || lease.leaseStatus.opening?.downpayment || lease.leaseStatus.paid?.amount;
  let protocol = lease.protocol;

  let ticker = lease.leaseData!.leasePositionTicker!;

  if (ticker.includes("@")) {
    let [t, p] = ticker.split("@");
    ticker = t;
    protocol = p;
  }

  if (CurrencyDemapping[ticker]) {
    ticker = CurrencyDemapping[ticker].ticker;
  }

  const asset = app.currenciesData?.[`${ticker}@${protocol}`];

  switch (ProtocolsConfig[lease.protocol].type) {
    case PositionTypes.long: {
      const price = oracle.prices?.[`${ticker}@${protocol}`];

      const value = new Dec(amount!.amount, asset?.decimal_digits).mul(new Dec(price.amount));
      return value.toString(NATIVE_CURRENCY.maximumFractionDigits);
    }
    case PositionTypes.short: {
      const value = new Dec(amount!.amount, asset!.decimal_digits);
      return value.toString(NATIVE_CURRENCY.maximumFractionDigits);
    }
  }

  return "0";
});

const lpn = computed(() => {
  if (props.lease) {
    const l = AssetUtils.getLpnByProtocol(props.lease!.protocol);
    return l;
  }
});

const debt = computed(() => {
  if (props.lease) {
    const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
      props.lease.debt.toString(),
      lpn.value!.ibcData,
      lpn.value!.decimal_digits
    ).amount.toString();
    return microAmount;
  }
  return "0";
});

const downPayment = computed(() => {
  if (props.lease) {
    const amount = props.lease.leaseData?.downPayment.add(props.lease.leaseData?.repayment_value);

    return amount!.toString(NATIVE_CURRENCY.maximumFractionDigits);
  }
  return "0";
});

const fee = computed(() => {
  if (props.lease) {
    const amount = props.lease.leaseData?.fee;

    return amount!.toString(NATIVE_CURRENCY.maximumFractionDigits);
  }
  return "0";
});

const currentPrice = computed(() => {
  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      if (props.lease?.leaseStatus?.opening && props.lease?.leaseData) {
        const item = app.currenciesData?.[props.lease?.leaseData?.leasePositionTicker as string];
        return oracle.prices[item?.ibcData as string]?.amount ?? "0";
      }
      break;
    }
    case PositionTypes.short: {
      if (props.lease?.leaseStatus?.opening && props.lease?.leaseData) {
        return oracle.prices[`${props.lease.leaseStatus.opening.loan.ticker}@${props.lease.protocol}`]?.amount ?? "0";
      }
    }
  }

  const ticker =
    CurrencyDemapping[props.lease?.leaseData?.leasePositionTicker!]?.ticker ??
    props.lease?.leaseData?.leasePositionTicker;

  return oracle.prices[`${ticker}@${props.lease?.protocol}`]?.amount ?? "0";
});

const interestDue = computed(() => {
  const data = props.lease?.leaseStatus?.opened;

  if (data) {
    const due = props.lease!.interestDue;
    return due.toString();
  }

  return "0";
});

const interest = computed(() => {
  const data = props.lease;

  if (data) {
    return data.interest.toString(2);
  }

  return "0.00";
});

const liquidation = computed(() => {
  const lease = props.lease?.leaseStatus?.opened;
  if (lease) {
    return `${props.lease.liquidation!.toString(MID_DECIMALS)}`;
  }
  return "0";
});

const liquidationPercent = computed(() => {
  const lease = props.lease?.leaseStatus?.opened;
  if (lease) {
    const price = props.lease.liquidation;
    const cPrice = getCurrentPrice()!;
    const diff = cPrice.sub(price);
    const percent = diff.quo(cPrice).mul(new Dec(PERCENT)).mul(new Dec(-1)).toString(2);
    return `${percent}`;
  }
  return "0";
});

function getCurrentPrice() {
  const key = `${props.lease?.leaseData?.leasePositionTicker}@${props.lease?.protocol}`;
  const price = oracle.prices[key];
  return new Dec(price?.amount ?? 0);
}

const interestDueDate = computed(() => {
  const lease = props.lease?.leaseStatus?.opened;
  let date = new Date();
  if (lease) {
    date = new Date(date.getTime() + Number(lease.overdue_collect_in) / 1000 / 1000);
  }
  return datePraser(date.toISOString(), true);
});

async function onRemoveStopLoss() {
  try {
    await walletOperation(onSetStopLoss);
  } catch (error: Error | any) {}
}

async function onSetStopLoss() {
  const wallet = walletStore.wallet as NolusWallet;
  if (wallet) {
    try {
      loadingStopLoss.value = true;

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, props.lease?.leaseAddress!);
      const price = getPrice();

      if (!price) {
        return;
      }

      const takeProfit = props.lease?.leaseStatus.opened?.close_policy.take_profit;
      const { txHash, txBytes, usedFee } = await leaseClient.simulateChangeClosePolicyTx(wallet, null, takeProfit);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      walletStore.loadActivities();
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
  if (wallet) {
    try {
      loadingTakeProfit.value = true;

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, props.lease?.leaseAddress!);
      const price = getPrice();

      if (!price) {
        return;
      }

      const stopLoss = props.lease?.leaseStatus.opened?.close_policy.stop_loss;
      const { txHash, txBytes, usedFee } = await leaseClient.simulateChangeClosePolicyTx(wallet, stopLoss, null);
      await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      walletStore.loadActivities();
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
