<template>
  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
    :data-length="data.length"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot } from "@observablehq/plot";
import { pointer, select, type Selection } from "d3";
import { isMobile } from "@/common/utils";
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import { CHART_AXIS, createUsdTickFormat, computeMarginLeft, computeYTicks, getChartWidth } from "@/common/utils/ChartUtils";
import { useI18n } from "vue-i18n";

import { ref, watch } from "vue";
import { useStatsStore } from "@/common/stores";

const props = defineProps<{
  period: string;
}>();

type ChartData = { date: Date; borrowed: number; supplied: number };

const mobile = isMobile();
const chartHeight = 250;
let chartWidth: number;
let marginLeft: number;
const marginRight = 30;
const marginBottom = 50;

const data = ref<ChartData[]>([]);
const i18n = useI18n();
const chart = ref<typeof Chart>();
const statsStore = useStatsStore();

// Watch for supplyBorrowHistory changes from store
watch(
  () => statsStore.supplyBorrowHistory,
  (response) => {
    if (response && response.length > 0) {
      data.value = response
        .map((d) => ({
          date: new Date(d.lp_pool_timestamp as string),
          borrowed: d.borrowed as number,
          supplied: d.supplied as number
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
  () => loadData()
);

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);

  // Downsample to ~200 points for a smoother chart
  const maxPoints = 200;
  const chartData =
    data.value.length > maxPoints
      ? data.value.filter((_, i) => i % Math.ceil(data.value.length / maxPoints) === 0)
      : data.value;

  const allValues = chartData.flatMap((d) => [d.borrowed, d.supplied]);
  const yDomain: [number, number] = [Math.min(...allValues), Math.max(...allValues)];
  const tickFormat = createUsdTickFormat(yDomain);
  const yTicks = computeYTicks(yDomain);
  marginLeft = computeMarginLeft(yDomain, tickFormat, yTicks);

  const plotChart = plot({
    style: { fontSize: CHART_AXIS.fontSize },
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginRight: marginRight,
    marginBottom: marginBottom,
    y: {
      type: "linear",
      grid: true,
      label: null,
      tickSize: 0,
      tickFormat,
      ticks: yTicks
    },
    x: { type: "time", label: null, ticks: CHART_AXIS.xTicks },
    marks: [
      lineY(chartData, {
        x: "date",
        y: "borrowed",
        stroke: "#3470E2",
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "catmull-rom",
        clip: "frame"
      }),
      lineY(chartData, {
        x: "date",
        y: "supplied",
        stroke: "#19A96C",
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "catmull-rom",
        clip: "frame"
      })
    ]
  });

  plotContainer.appendChild(plotChart);

  select(plotChart).selectAll("path").transition().duration(400).attr("opacity", 1);

  const crosshair = select(plotChart)
    .append("line")
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.15)
    .attr("stroke-width", 1)
    .attr("y1", 0)
    .attr("y2", chartHeight - marginBottom)
    .style("display", "none");

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);

      const closestData = getClosestDataPoint(x);

      if (closestData) {
        crosshair.attr("x1", x).attr("x2", x).style("display", null);

        tooltip.html(
          `<strong>${i18n.t("message.supplied")}:</strong> ${formatUsd(closestData.supplied)}<br><strong>${i18n.t("message.borrowed-chart")}:</strong> ${formatUsd(closestData.borrowed)}`
        );

        const node = tooltip.node()!.getBoundingClientRect();
        const height = node.height;
        const width = node.width;

        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - width / 2}px`)
          .style("top", `${event.pageY - height - 10}px`);
      }
    })
    .on("mouseleave", () => {
      crosshair.style("display", "none");
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  const plotAreaWidth = chartWidth - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;

  if (data.value.length === 0) return null;

  // Scale `adjustedX` to match `loans` range
  const maxDate = Math.max(...data.value.map((d) => d.date.getTime()));
  const minDate = Math.min(...data.value.map((d) => d.date.getTime()));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);

  // Convert adjustedX to the corresponding date value
  const targetDate = adjustedX / xScale + minDate;

  // Find the closest loans point
  let closest = data.value[0];
  let minDiff = Math.abs(targetDate - closest.date.getTime());

  for (const point of data.value) {
    const diff = Math.abs(targetDate - point.date.getTime());
    if (diff < minDiff) {
      closest = point;
      minDiff = diff;
    }
  }

  return closest;
}

async function loadData() {
  await statsStore.fetchSupplyBorrowHistory(props.period);
}
</script>

<style lang="scss">
.custom-tooltip {
  @apply absolute max-w-[200px] rounded border border-border-emphasized bg-neutral-bg-50 p-2 text-xs text-typography-default;
  pointer-events: none;
  transition: opacity 0.2s;
}
</style>
