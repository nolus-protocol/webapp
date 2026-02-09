<template>
  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[setStats]"
    :getClosestDataPoint="getClosestDataPoint"
    :data-length="loans.length"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { binX, rectY, ruleY } from "@observablehq/plot";
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import { CHART_AXIS, createUsdTickFormat, computeMarginLeft, getChartWidth } from "@/common/utils/ChartUtils";
import { select, pointer, timeMonth, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { ref, watch } from "vue";
import { useStatsStore } from "@/common/stores";

const props = defineProps<{
  period: string;
}>();

const chartHeight = 300;
let chartWidth: number;
const marginBottom = 50;
let marginLeft: number;
const marginRight = 30;
const chart = ref<typeof Chart>();

const i18n = useI18n();
const loans = ref<{ amount: number; date: Date }[]>([]);
const statsStore = useStatsStore();

// Watch for monthlyLeases changes from store
watch(
  () => statsStore.monthlyLeases,
  (response) => {
    if (response && response.length > 0) {
      loans.value = response
        .map((d) => ({
          date: new Date(d.date as string),
          amount: d.amount as number
        }))
        .reverse();
      chart.value?.update();
    }
  },
  { immediate: true }
);

// Re-fetch when period changes from parent
watch(
  () => props.period,
  () => setStats()
);

async function setStats() {
  await statsStore.fetchMonthlyLeases(props.period);
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);

  const amounts = loans.value.map((d) => d.amount);
  const yDomain: [number, number] = [Math.min(0, ...amounts), Math.max(...amounts)];
  const tickFormat = createUsdTickFormat(yDomain);
  marginLeft = computeMarginLeft(yDomain, tickFormat);

  const plotChart = rectY(
    loans.value,
    // @ts-ignore
    binX({ y: "sum" }, { x: "date", y: "amount", fill: "#19A96C", thresholds: timeMonth })
  ).plot({
    style: { fontSize: CHART_AXIS.fontSize },
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginBottom: marginBottom,
    marginRight: marginRight,
    color: { legend: true },
    y: {
      grid: true,
      type: "linear",
      label: null,
      tickFormat,
      ticks: CHART_AXIS.yTicks
    },
    x: { label: null, interval: "months", ticks: CHART_AXIS.xTicks },
    marks: [ruleY([0])]
  });

  plotContainer.appendChild(plotChart);

  select(plotChart).selectAll("path").transition().duration(400).attr("opacity", 1);

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);
      const closestData = getClosestDataPoint(x);
      if (closestData) {
        tooltip.html(
          `<strong>${i18n.t("message.amount")}</strong> ${formatUsd(closestData.amount)}`
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

  select(plotChart).selectAll("rect").attr("rx", 3).attr("ry", 3);
}

function getClosestDataPoint(cPosition: number) {
  const plotAreaWidth = chartWidth - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;
  const barWidth = plotAreaWidth / loans.value.length;

  const barIndex = Math.floor(adjustedX / barWidth);

  if (barIndex >= 0 && barIndex < loans.value.length) {
    return loans.value[barIndex];
  }

  return null;
}
</script>
