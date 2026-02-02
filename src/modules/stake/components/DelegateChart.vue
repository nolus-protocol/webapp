<template>
  <Chart
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
    ref="chart"
    :data-length="data.length"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot } from "@observablehq/plot";
import { useI18n } from "vue-i18n";
import { pointer, select, type Selection } from "d3";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { NATIVE_ASSET, NATIVE_CURRENCY, PERCENT } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { ref, watch } from "vue";
import { Dec } from "@keplr-wallet/unit";

type ChartData = { amount: number; date: number };

const data = ref<ChartData[]>([]);
const period = [{ months: 0 }, { months: 12 }, { months: 24 }, { months: 48 }];
const days = 30;

const chartHeight = 300;
const marginLeft = 40;
const chartWidth = 400;
const marginRight = 30;
const marginBottom = 50;
const marginTop = 50;

const i18n = useI18n();
const wallet = useWalletStore();
const chart = ref<typeof Chart>();
const props = defineProps<{ amount: Dec }>();

watch(
  () => [wallet?.apr, props.amount],
  () => {
    loadData();
  },
  {
    immediate: true
  }
);

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = plot({
    color: { legend: true },
    style: { width: "100%" },
    marginTop,
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginRight: marginRight,
    marginBottom: marginBottom,
    y: {
      type: "linear",
      grid: true,
      label: i18n.t("message.earn-chart-y"),
      ticks: 4,
      round: true
    },
    x: { ticks: 4, type: "linear", round: true, tickFormat: (d) => `${d}m.` },
    marks: [
      lineY(data.value, {
        x: "date",
        y: "amount",
        stroke: "#3470E2",
        curve: "basis"
      })
    ]
  });

  plotContainer.appendChild(plotChart);

  select(plotChart).selectAll("path").transition().duration(400).attr("opacity", 1);

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);

      const closestData = getClosestDataPoint(x);
      if (closestData) {
        tooltip.html(
          `<strong>${i18n.t("message.amount")}</strong> ${formatNumber(closestData.amount, NATIVE_CURRENCY.maximumFractionDigits)} ${NATIVE_ASSET.label}`
        );

        const node = tooltip.node()!.getBoundingClientRect();
        const height = node.height;
        const width = node.width;

        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - width / 2}px`) // Using native event
          .style("top", `${event.pageY - height - 10}px`); // Using native event
      }
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  const plotAreaWidth = chartWidth - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;

  if (data.value.length === 0) return null;

  const maxDate = Math.max(...data.value.map((d) => d.date));
  const minDate = Math.min(...data.value.map((d) => d.date));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);

  const targetDate = adjustedX / xScale + minDate;

  let closest = data.value[0];
  let minDiff = Math.abs(targetDate - closest.date);

  for (const point of data.value) {
    const diff = Math.abs(targetDate - point.date);
    if (diff < minDiff) {
      closest = point;
      minDiff = diff;
    }
  }

  return closest;
}

async function loadData() {
  const apr = new Dec(wallet?.apr ?? 0);
  data.value = period.map((item) => {
    const p = item.months * days;
    const a = props.amount.add(apr.quo(new Dec(PERCENT)).mul(props.amount).mul(new Dec(p))).toString(2);
    return {
      amount: Number(a),
      date: item.months
    };
  });
  chart.value?.update();
}
</script>
