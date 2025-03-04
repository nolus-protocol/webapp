<template>
  <Widget class="h-fit flex-1"
    ><WidgetHeader
      :label="$t('message.position-health')"
      :icon="{ name: 'heart', class: 'fill-icon-link' }"
    />
    <EmptyState
      v-if="leaseStatus == TEMPLATES.opening"
      :slider="[
        {
          image: { name: 'position-health' },
          title: $t('message.position-health-empty'),
          description: $t('message.position-health-empty-description'),
          link: {
            label: $t('message.position-health-empty-link'),
            url: '#',
            tooltip: { content: $t('message.position-health-empty-tooltip') }
          }
        }
      ]"
    />

    <template v-else>
      <div class="relative flex flex-col items-center justify-center">
        <svg
          width="256"
          height="128"
          viewBox="0 0 256 128"
        >
          <path
            :d="arcPath(0, yellowEndAngle)"
            fill="none"
            stroke="#DF294D"
            stroke-width="12"
          />

          <path
            :d="arcPath(yellowEndAngle, greenEndAngle)"
            fill="none"
            stroke="#FFBF34"
            stroke-width="12"
          />

          <!-- Green Arc -->
          <path
            v-if="greenEndAngle > 0"
            :d="arcPath(greenEndAngle, 180)"
            fill="none"
            stroke="#19A96C"
            stroke-width="12"
            stroke-linecap="round"
          />

          <!-- Yellow Arc -->

          <!-- Red Arc -->
        </svg>
        <HealthArrow
          class="absolute bottom-0 left-0 right-0 mx-auto origin-bottom transform"
          :style="[`${rotationStyle}`]"
        />
      </div>
      <div class="flex flex-col items-center text-typography-default">
        <div class="text-32 font-semibold">{{ health }}%</div>
        <div class="text-16">
          {{ $t("message.current-health") }}:
          <span class="font-semibold">
            {{ $t(`message.${healTitle}-status`) }}
          </span>
        </div>
        <a
          href="#"
          target="_blank"
          class="flex w-fit items-center gap-1 text-14 font-normal text-typography-link"
          >{{ $t("message.learn-health") }}
          <Tooltip :content="$t('message.position-health-tooltip')"
            ><SvgIcon
              name="help"
              class="fill-icon-link" /></Tooltip
        ></a>
      </div>
    </template>
  </Widget>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { SvgIcon, Tooltip, Widget } from "web-components";
import { CurrencyDemapping } from "@/config/currencies";
import { Dec } from "@keplr-wallet/unit";
import { AssetUtils } from "@/common/utils";

import WidgetHeader from "@/common/components/WidgetHeader.vue";
import HealthArrow from "@/assets/icons/lease/health-arrow.svg";
import { useOracleStore } from "@/common/stores/oracle";
import type { LeaseData } from "@/common/types";
import { getStatus, TEMPLATES } from "../common";
import EmptyState from "@/common/components/EmptyState.vue";
import { LTV, PERCENT } from "@/config/global";

const radius = 112;
const centerX = 128;
const centerY = 128;

enum status {
  green = "green",
  yellow = "yellow",
  red = "red"
}

const props = withDefaults(
  defineProps<{
    lease?: LeaseData;
    greenLimit?: number;
    yellowLimit?: number;
  }>(),
  {
    greenLimit: 57,
    yellowLimit: 20
  }
);

const healTitle = computed((item) => {
  const p = PERCENT - health.value;

  if (p <= props.greenLimit) {
    return status.green;
  }

  if (p < props.yellowLimit && p > props.greenLimit) {
    return status.yellow;
  }
  if (p >= props.yellowLimit) {
    return status.red;
  }
});

const oracle = useOracleStore();
const greenEndAngle = computed(() => (props.greenLimit / 100) * 180);
const yellowEndAngle = computed(() => (props.yellowLimit / 100) * 180);
const rotationStyle = computed(() => {
  const p = health.value;

  const angle = (p / 100) * 180;
  if (angle >= 90) {
    return `rotate: ${angle - 90}deg`;
  }

  return `rotate: -${90 - angle}deg`;
});

const arcPath = (startAngle: number, endAngle: number) => {
  const startX = centerX + radius * Math.cos((180 - startAngle) * (Math.PI / 180));
  const startY = centerY - radius * Math.sin(startAngle * (Math.PI / 180));
  const endX = centerX + radius * Math.cos((180 - endAngle) * (Math.PI / 180));
  const endY = centerY - radius * Math.sin(endAngle * (Math.PI / 180));

  return `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
};

const health = computed(() => {
  if (props.lease?.leaseStatus.opened) {
    const { overdue_interest, overdue_margin, principal_due, amount, due_margin, due_interest } =
      props.lease?.leaseStatus.opened;

    const externalCurrencies = [overdue_interest, overdue_margin, due_margin, due_interest, principal_due, amount].map(
      (amount) => AssetUtils.getCurrencyByTicker(amount?.ticker as string)
    );

    const l = AssetUtils.getLpnByProtocol(props.lease.protocol);
    const [t, p] = externalCurrencies[5].key.split("@");
    const price = oracle.prices[`${CurrencyDemapping[t]?.ticker ?? t}@${props.lease.protocol}`];

    const marginPrice = oracle.prices[l.key];
    const priceAmount = new Dec(amount.amount, externalCurrencies[5].decimal_digits).mul(new Dec(price?.amount ?? 1));
    const margin = new Dec(overdue_interest.amount, externalCurrencies[0].decimal_digits)
      .add(new Dec(overdue_margin.amount, externalCurrencies[1].decimal_digits))
      .add(new Dec(due_margin.amount, externalCurrencies[2].decimal_digits))
      .add(new Dec(due_interest.amount, externalCurrencies[3].decimal_digits))
      .add(new Dec(principal_due.amount, externalCurrencies[4].decimal_digits));

    const margin_total = margin.mul(new Dec(marginPrice.amount));
    const health = new Dec(1).sub(margin_total.quo(priceAmount).quo(new Dec(LTV)));

    return Number(health.mul(new Dec(PERCENT)).toString(2)); // 100% is the max value
  }

  return 0;
});

const leaseStatus = computed(() => {
  return getStatus(props.lease as LeaseData);
});
</script>
