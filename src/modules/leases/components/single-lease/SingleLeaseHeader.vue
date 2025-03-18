<template>
  <div class="flex flex-1 flex-col justify-between gap-y-2 border-b border-border-color pb-3 lg:flex-row lg:gap-0">
    <div class="flex items-center">
      <SvgIcon
        name="arrow-left"
        size="l"
        class="mx-4 cursor-pointer text-icon-default"
        @click="goBack"
      />
      <div class="flex flex-col">
        <div class="text-24 font-semibold text-typography-default">#{{ lease?.leaseAddress.slice(-8) }}</div>
        <div class="flex items-center gap-4">
          <div class="flex gap-1 text-14 text-typography-default">
            {{ $t("message.type") }}:<span class="font-semibold">
              {{
                ProtocolsConfig[lease?.protocol!]?.type ? $t(`message.${ProtocolsConfig[lease?.protocol!]?.type}`) : ""
              }}
            </span>
          </div>
          <div
            v-if="TEMPLATES.opened == status"
            class="m flex items-center gap-1 text-14 text-typography-default"
          >
            <span class="mr-1">{{ $t("message.pnl") }}: </span>

            <div
              v-if="loading"
              class="skeleton-box rounded-[4px]"
              :style="[{ width: '80px', height: `${16 * 1.2}px` }]"
            ></div>
            <template v-else>
              <span class="font-semibold">
                <Label
                  v-if="pnl.neutral"
                  variant="info"
                >
                  <SvgIcon
                    name="arrow-up"
                    size="xs"
                  />
                  <span class="ml-1">{{ pnl.status ? "+" : "" }}{{ pnl.percent }}%</span>
                </Label>
                <template v-else>
                  <Label :variant="pnl?.status ? 'success' : 'error'">
                    <SvgIcon
                      v-if="pnl?.status"
                      name="arrow-up"
                      size="xs"
                      class="fill-icon-success"
                    />
                    <SvgIcon
                      v-if="pnl?.status == false"
                      name="arrow-down"
                      size="xs"
                      class="fill-icon-error"
                    />
                    <span class="ml-1">{{ pnl.status ? "+" : "" }}{{ pnl.percent }}%</span>
                  </Label>
                </template>
              </span>
            </template>
          </div>
          <div class="hidden gap-1 text-14 text-typography-default md:flex">
            {{ $t("message.opened-on") }}:<span class="font-semibold">{{
              lease?.leaseData ? formatDate(lease!.leaseData!.timestamp.toString()) : ""
            }}</span>
          </div>
          <div class="hidden gap-1 text-14 text-typography-default md:flex">
            {{ $t("message.lease-size") }}:<span class="font-semibold">
              <div
                v-if="loading"
                class="skeleton-box rounded-[4px]"
                :style="[{ width: '80px', height: `${16 * 1.2}px` }]"
              ></div>
              <template v-else> {{ NATIVE_CURRENCY.symbol }}{{ stable }} </template>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3 border-t border-border-color pt-3 md:border-none md:pt-0">
      <Button
        :label="$t('message.share-position')"
        severity="tertiary"
        icon="share"
        iconPosition="left"
        size="medium"
        @click="sharePnlDialog?.show(lease)"
        v-if="TEMPLATES.opened == status"
      />
      <Button
        :label="$t('message.repay')"
        severity="secondary"
        size="medium"
        @click="
          router.push({
            path: `/${RouteNames.LEASES}/${lease?.protocol?.toLowerCase()}/${lease?.leaseAddress}/${SingleLeaseDialog.REPAY}`
          })
        "
        v-if="TEMPLATES.opened == status && !openedSubState"
      />
      <Button
        :label="$t('message.close')"
        severity="primary"
        size="medium"
        @click="
          router.push({
            path: `/${RouteNames.LEASES}/${lease?.protocol?.toLowerCase()}/${lease?.leaseAddress}/${SingleLeaseDialog.CLOSE}`
          })
        "
        v-if="TEMPLATES.opened == status && !openedSubState"
      />
      <Collect
        :lease="lease!"
        severity="primary"
        v-if="TEMPLATES.paid == status"
      />
    </div>
    <SharePnLDialog ref="sharePnlDialog" />
  </div>
</template>

<script lang="ts" setup>
import Collect from "./Collect.vue";
import type { LeaseData } from "@/common/types";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Button, Label, SvgIcon } from "web-components";

import { RouteNames } from "@/router";
import { AssetUtils, formatDate } from "@/common/utils";
import { SingleLeaseDialog } from "@/modules/leases/enums";

import SharePnLDialog from "@/modules/leases/components/single-lease/SharePnLDialog.vue";
import { NATIVE_CURRENCY, PositionTypes, ProtocolsConfig } from "@/config/global";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyDemapping } from "@/config/currencies";
import { getStatus, TEMPLATES } from "../common";

const sharePnlDialog = ref<typeof SharePnLDialog | null>(null);
const router = useRouter();

const pnl = ref({
  percent: "0.00",
  amount: CurrencyUtils.formatPrice("0.00"),
  status: true,
  neutral: true
});

const props = defineProps<{
  lease?: LeaseData;
  loading?: boolean;
}>();

const oracle = useOracleStore();
const app = useApplicationStore();

watch(
  () => props.lease,
  () => {
    pnl.value = {
      percent: props.lease!.pnlPercent.toString(2),
      amount: CurrencyUtils.formatPrice(props.lease!.pnlAmount.toString()),
      status: props.lease!.pnlAmount.isPositive() || props.lease!.pnlAmount.isZero(),
      neutral: false
    };
  }
);

const openedSubState = computed(() => {
  const data = props.lease?.leaseStatus.opened;
  if (data?.in_progress != null) {
    return true;
  }

  return false;
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

const currentPrice = computed(() => {
  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      if (props.lease?.leaseStatus?.opening && props.lease?.leaseData) {
        const item = app.currenciesData?.[props.lease?.leaseData?.leasePositionTicker as string];
        return AssetUtils.formatNumber(
          oracle.prices[item?.ibcData as string]?.amount ?? "0",
          asset.value?.decimal_digits!
        );
      }
      break;
    }
    case PositionTypes.short: {
      if (props.lease?.leaseStatus?.opening && props.lease?.leaseData) {
        return AssetUtils.formatNumber(
          oracle.prices[`${props.lease.leaseStatus.opening.loan.ticker}@${props.lease.protocol}`]?.amount ?? "0",
          asset.value?.decimal_digits!
        );
      }
    }
  }

  const ticker =
    CurrencyDemapping[props.lease?.leaseData?.leasePositionTicker!]?.ticker ??
    props.lease?.leaseData?.leasePositionTicker;

  return AssetUtils.formatNumber(
    oracle.prices[`${ticker}@${props.lease?.protocol}`]?.amount ?? "0",
    asset.value?.decimal_digits!
  );
});

function goBack() {
  router.push(`/${RouteNames.LEASES}`);
}

const status = computed(() => {
  return getStatus(props.lease as LeaseData);
});
</script>
