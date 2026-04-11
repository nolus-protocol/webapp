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
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import {
  CHART_AXIS,
  createUsdTickFormat,
  computeMarginLeft,
  computeYTicks,
  findClosestPoint,
  getChartWidth
} from "@/common/utils/ChartUtils";
import { useI18n } from "vue-i18n";

import { ref, watch } from "vue";
import { useStatsStore } from "@/common/stores";

const styles = window.getComputedStyle(document.documentElement);

const props = defineProps<{
  period: string;
}>();

type ChartData = { date: Date; borrowed: number; supplied: number };

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

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>) {
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
  const yDomain: [number, number] = [0, Math.max(...allValues)];
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
      domain: yDomain,
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
        stroke: styles.getPropertyValue("--color-primary-default"),
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "catmull-rom",
        clip: "frame"
      }),
      lineY(chartData, {
        x: "date",
        y: "supplied",
        stroke: styles.getPropertyValue("--color-icon-success"),
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

  const dotSupplied = select(plotChart)
    .append("circle")
    .attr("r", 5)
    .attr("fill", styles.getPropertyValue("--color-icon-success"))
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .style("display", "none");

  const dotBorrowed = select(plotChart)
    .append("circle")
    .attr("r", 5)
    .attr("fill", styles.getPropertyValue("--color-primary-default"))
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .style("display", "none");

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);

      const closestData = getClosestDataPoint(x);

      if (closestData) {
        const xScale = plotChart.scale("x");
        const yScale = plotChart.scale("y");
        if (!xScale || !yScale) return;
        const xPixel = xScale.apply(closestData.date);

        crosshair.attr("x1", xPixel).attr("x2", xPixel).style("display", null);

        dotSupplied.attr("cx", xPixel).attr("cy", yScale.apply(closestData.supplied)).style("display", null);

        if (closestData.borrowed != null) {
          dotBorrowed.attr("cx", xPixel).attr("cy", yScale.apply(closestData.borrowed)).style("display", null);
        } else {
          dotBorrowed.style("display", "none");
        }

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
      dotSupplied.style("display", "none");
      dotBorrowed.style("display", "none");
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  return findClosestPoint(data.value, (d) => d.date.getTime(), chartWidth, marginLeft, marginRight, cPosition);
}

async function loadData() {
  await statsStore.fetchSupplyBorrowHistory(props.period);
}
</script>
