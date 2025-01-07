<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.position-summary')"
      :icon="{ name: 'bar-chart', class: 'fill-icon-link' }"
    />
    <div class="flex flex-col gap-6 md:flex-row md:gap-8">
      <div class="flex flex-col gap-3">
        <BigNumber
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
              :label="$t('message.outstanding-loan')"
              :label-tooltip="{ content: 'text for tooltip' }"
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
              :label="$t('message.down-payment')"
              :label-tooltip="{ content: 'text for tooltip' }"
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
              :label="$t('message.impact-dex-fee')"
              :label-tooltip="{ content: 'text for tooltip' }"
              :amount="{
                amount: fee,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                fontSize: 16,
                fontSizeSmall: 16
              }"
            />
          </div>
          <div class="flex flex-col gap-4">
            <BigNumber
              :label="$t('message.price-per-asset')"
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
              :label="$t('message.partial-liquidation')"
              :label-tooltip="{ content: 'text for tooltip' }"
              :amount="{
                amount: liquidationPercent,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: `% (${NATIVE_CURRENCY.symbol}${liquidation})`,
                isDenomInfront: false,
                decimals: 2,
                fontSize: 16,
                fontSizeSmall: 16
              }"
            />
            <BigNumber
              :label="$t('message.interest-fee')"
              :label-tooltip="{ content: 'text for tooltip' }"
              :amount="{
                amount: interest,
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: '%',
                isDenomInfront: false,
                fontSize: 16,
                fontSizeSmall: 16
              }"
            />
            <BigNumber
              :label="$t('message.interest-due')"
              :label-tooltip="{ content: 'text for tooltip' }"
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
        </div>
      </div>
      <span class="border-b border-border-color md:block md:border-r" />
      <div class="flex flex-1 flex-col gap-4">
        <BigNumber
          label="Unrealized P&L"
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
              <Tooltip content="some content">
                <SvgIcon
                  name="help"
                  class="rouded-full"
                  size="s"
                /> </Tooltip
            ></span>
            <Button
              :label="$t('message.set-stop-loss')"
              severity="secondary"
              size="small"
            />
          </div>
          <div class="flex flex-col gap-2">
            <span class="flex items-center gap-1">
              {{ $t("message.take-profit-price") }}
              <Tooltip content="some content">
                <SvgIcon
                  name="help"
                  class="rouded-full"
                  size="s"
                /> </Tooltip
            ></span>
            <Button
              :label="$t('message.set-take-profit')"
              severity="secondary"
              size="small"
            />
          </div>
        </div>
        <hr class="border-t border-border-color" />
        <PnlOverTimeChart />
      </div>
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import { Button, SvgIcon, Tooltip, Widget } from "web-components";

import { CURRENCY_VIEW_TYPES, type LeaseData } from "@/common/types";

import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import PnlOverTimeChart from "./PnlOverTimeChart.vue";
import { MID_DECIMALS, NATIVE_CURRENCY, PERCENT, PositionTypes, ProtocolsConfig } from "@/config/global";
import { computed, ref, watch } from "vue";
import { useApplicationStore } from "@/common/stores/application";
import { useOracleStore } from "@/common/stores/oracle";
import { Dec } from "@keplr-wallet/unit";
import { AssetUtils } from "@/common/utils/AssetUtils";
import { CurrencyDemapping } from "@/config/currencies";
import { CurrencyUtils } from "@nolus/nolusjs";

const props = defineProps<{
  lease?: LeaseData;
}>();

const app = useApplicationStore();
const oracle = useOracleStore();

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
    const cPrice = new Dec(currentPrice.value);
    const diff = cPrice.sub(price);
    const percent = diff.quo(cPrice).mul(new Dec(PERCENT)).toString(2);
    return `-${percent}`;
  }
  return "0";
});
</script>
