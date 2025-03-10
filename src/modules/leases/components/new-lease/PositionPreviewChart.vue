<template>
  <Chart
    :updateChart="updateChart"
    :fns="[setStats]"
    :getClosestDataPoint="getClosestDataPoint"
    ref="chart"
    :disableSkeleton="true"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";

import type { ExternalCurrency } from "@/common/types";
import { AssetUtils } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { plot, barY, axisX, text, ruleY } from "@observablehq/plot";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { select, pointer, type Selection } from "d3";

const marginBottom = 50;
const marginLeft = 30;
const marginRight = 30;
const chart = ref<typeof Chart>();

const i18n = useI18n();

const props = defineProps<{
  downPaymentStable: Dec;
  downPaymentAmount: string;
  downPaymentAsset: ExternalCurrency;

  borrowStable: Dec;
  borrowAmount: string;
  borrowAsset: ExternalCurrency;
}>();
const zero = 0.00000001;

const responses = ref<{ name: string; value: number; ticker: string; price: string }[]>([
  {
    name: i18n.t("message.borrowed-taxes"),
    value: zero,
    ticker: `${new Dec(props.borrowAmount, props.borrowAsset.decimal_digits).toString(props.borrowAsset.decimal_digits)} ${props.borrowAsset.shortName}`,
    price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.borrowStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
  },
  {
    name: i18n.t("message.downpayment"),
    value: zero,
    ticker: `${new Dec(props.downPaymentAmount, props.downPaymentAsset.decimal_digits).toString(props.downPaymentAsset.decimal_digits)} ${props.downPaymentAsset.shortName}`,
    price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.downPaymentStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
  }
]);

watch(
  () => [
    props.downPaymentStable,
    props.downPaymentAmount,
    props.downPaymentAsset,
    props.borrowStable,
    props.borrowAmount,
    props.borrowAsset
  ],
  () => {
    setStats();
    chart.value?.update();
  }
);

async function setStats() {
  const v1 = Number(`${props.borrowStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`);
  const v2 = Number(`${props.downPaymentStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`);
  responses.value = [
    {
      name: i18n.t("message.borrowed-taxes"),
      value: v1 == 0 ? zero : v1,
      ticker: `${new Dec(props.borrowAmount, props.borrowAsset.decimal_digits).toString(props.borrowAsset.decimal_digits)} ${props.borrowAsset.shortName}`,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.borrowStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    },
    {
      name: i18n.t("message.downpayment"),
      value: v2 == 0 ? zero : v2,
      ticker: `${new Dec(props.downPaymentAmount, props.downPaymentAsset.decimal_digits).toString(props.downPaymentAsset.decimal_digits)} ${props.downPaymentAsset.shortName}`,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.downPaymentStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    }
  ];
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = plot({
    className: "position-preview-chart",
    y: { label: null, ticks: 3, tickFormat: (d) => `$${d}`, tickSize: 0, line: true },
    marginBottom,
    marginLeft,
    marginRight,
    marks: [
      axisX({ label: null, tickSize: 0, fontSize: 16 }),
      barY([responses.value[1]], {
        x: "name",
        y: "value",
        fill: "#C1CAD7",
        rx: 6,
        insetBottom: 0,
        clip: "frame"
      }),
      barY([responses.value[0]], { x: "name", y: "value", fill: "#19A96C", rx: 6, insetBottom: 0, clip: "frame" }),
      text(responses.value, {
        x: "name",
        y: "value",
        dy: 30,
        fontSize: 14,
        text(d) {
          return `${d.price} \n ${d.ticker}`;
        },
        title: (d) => `class-${d.ticker.toLowerCase()}`
      }),
      ruleY([0])
    ]
  });

  plotContainer.appendChild(plotChart);

  select(plotChart).selectAll("rect").transition().duration(600).attr("opacity", 1);

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);
      const width = plotChart.clientWidth;

      const closestData = getClosestDataPoint(x, width);
      if (closestData) {
        tooltip.html(
          `<strong>${i18n.t("message.amount")}</strong> $${AssetUtils.formatNumber(closestData.value, NATIVE_CURRENCY.maximumFractionDigits)}`
        );

        const node = tooltip?.node()!.getBoundingClientRect();
        const height = node.height;
        const width = node.width;
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - width / 2}px`)
          .style("top", `${event.pageY - height - 10}px`);
      }
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number, width: number) {
  const plotAreaWidth = width - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;
  const barWidth = plotAreaWidth / responses.value.length;

  const barIndex = Math.floor(adjustedX / barWidth);

  if (barIndex >= 0 && barIndex < responses.value.length) {
    return responses.value[barIndex];
  }

  return null;
}
</script>

<style lang="scss">
.position-preview-chart {
  @apply text-typography-default;
}
</style>
