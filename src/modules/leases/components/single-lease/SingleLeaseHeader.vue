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
        <div class="text-24 font-semibold text-typography-default">#{{ lease?.address?.slice(-8) }}</div>
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
                  variant="success"
                >
                  <SvgIcon
                    name="arrow-up"
                    size="xs"
                    class="fill-icon-success"
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
              lease?.opened_at ? formatDate(lease.opened_at) : ""
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
        @click="sharePnlDialog?.show(lease, displayData)"
        v-if="TEMPLATES.opened == status"
      />
      <Button
        :label="$t('message.repay')"
        severity="secondary"
        size="medium"
        @click="
          router.push({
            path: `/${RouteNames.LEASES}/${lease?.protocol?.toLowerCase()}/${lease?.address}/${SingleLeaseDialog.REPAY}`
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
            path: `/${RouteNames.LEASES}/${lease?.protocol?.toLowerCase()}/${lease?.address}/${SingleLeaseDialog.CLOSE}`
          })
        "
        v-if="TEMPLATES.opened == status && !openedSubState"
      />
    </div>
    <SharePnLDialog ref="sharePnlDialog" />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Button, Label, SvgIcon } from "web-components";

import { RouteNames } from "@/router";
import { formatDate } from "@/common/utils";
import { SingleLeaseDialog } from "@/modules/leases/enums";

import SharePnLDialog from "@/modules/leases/components/single-lease/SharePnLDialog.vue";
import { NATIVE_CURRENCY, PositionTypes, ProtocolsConfig } from "@/config/global";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { Dec } from "@keplr-wallet/unit";
import { TEMPLATES } from "../common";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";

const sharePnlDialog = ref<typeof SharePnLDialog | null>(null);
const router = useRouter();

const props = defineProps<{
  lease?: LeaseInfo | null;
  displayData?: LeaseDisplayData | null;
  loading?: boolean;
}>();

const pricesStore = usePricesStore();
const configStore = useConfigStore();

const pnl = computed(() => {
  if (!props.displayData) {
    return { percent: "0.00", amount: "0.00", status: true, neutral: true };
  }
  return {
    percent: props.displayData.pnlPercent.toString(2),
    amount: props.displayData.pnlAmount.toString(),
    status: props.displayData.pnlPositive,
    neutral: false
  };
});

const openedSubState = computed(() => {
  // Check if there's an in-progress operation
  return props.displayData?.inProgressType != null;
});

const stable = computed(() => {
  if (!props.lease || !props.displayData) {
    return "0.00";
  }

  const posType = props.displayData.positionType;
  const ticker = props.lease.amount.ticker;
  const protocol = props.lease.protocol;
  const asset = configStore.currenciesData?.[`${ticker}@${protocol}`];

  if (posType === PositionTypes.long) {
    const price = pricesStore.prices[`${ticker}@${protocol}`];
    const value = new Dec(props.lease.amount.amount, asset?.decimal_digits ?? 0).mul(new Dec(price?.price ?? "0"));
    return value.toString(NATIVE_CURRENCY.maximumFractionDigits);
  } else if (posType === PositionTypes.short) {
    const c = configStore.currenciesData?.[`${ProtocolsConfig[protocol]?.stable}@${protocol}`];
    const value = new Dec(props.lease.amount.amount, c?.decimal_digits ?? 0);
    return value.toString(NATIVE_CURRENCY.maximumFractionDigits);
  }

  return "0";
});

function goBack() {
  router.push(`/${RouteNames.LEASES}`);
}

const status = computed(() => {
  if (!props.lease) return TEMPLATES.opening;
  switch (props.lease.status) {
    case "opening": return TEMPLATES.opening;
    case "opened": return TEMPLATES.opened;
    case "paid_off": return TEMPLATES.paid;
    case "closing": return TEMPLATES.paid;
    case "closed": return TEMPLATES.closed;
    case "liquidated": return TEMPLATES.liquidated;
    default: return TEMPLATES.opening;
  }
});
</script>
