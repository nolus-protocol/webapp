<template>
  <div class="chart-container overflow-hidden">
    <Chart
      :data-length="data.length"
      ref="chart"
      :updateChart="updateChart"
      :fns="[setData]"
      :getClosestDataPoint="getClosestDataPoint"
    />
  </div>
  <div
    class="flex justify-center"
    v-if="chart?.isLegendVisible"
  >
    <div class="flex items-center text-sm">
      <span class="btn-gradient m-2 block h-[4px] w-[12px] rounded"></span>
      {{ $t("message.pnl-in-usdc") }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { ref, watch } from "vue";
import { plot, line } from "@observablehq/plot";
import { pointer, select, type Selection } from "d3";

import { CHART_RANGES } from "@/config/global";
import { useI18n } from "vue-i18n";
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import {
  CHART_AXIS,
  createUsdTickFormat,
  computeMarginLeft,
  computeYTicks,
  findClosestPoint,
  getChartWidth
} from "@/common/utils/ChartUtils";
import type { LeaseInfo } from "@/common/api";
import { useAnalyticsStore } from "@/common/stores";

const styles = window.getComputedStyle(document.documentElement);

type ChartData = { amount: number; date: Date };

const chartHeight = 250;
let chartWidth: number;
let marginLeft: number;
const marginRight = 20;
const marginBottom = 40;

const i18n = useI18n();
const chartTimeRange = ref(CHART_RANGES["1"]);

const data = ref<ChartData[]>([
  {
    amount: 0,
    date: new Date(Date.now() - 1000 * 60 * 60)
  },
  {
    amount: 0,
    date: new Date()
  }
]);
const chart = ref<typeof Chart>();
const props = defineProps<{ lease?: LeaseInfo | null }>();
const analyticsStore = useAnalyticsStore();


async function setData() {
  if (props.lease?.address) {
    await analyticsStore.fetchPnlOverTime(props.lease.address, chartTimeRange.value.days);
    if (analyticsStore.pnlOverTime.length > 0) {
      data.value = analyticsStore.pnlOverTime.map((d) => ({
        date: new Date(d.date),
        amount: Number(d.amount)
      }));
    }
    chart.value?.update();
  }
}

watch(
  () => [props.lease?.address, props.lease?.status, chartTimeRange.value],
  () => {
    setData();
  }
);

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);
  const amounts = data.value.map((d) => d.amount);
  const yDomain: [number, number] = [Math.min(...amounts), Math.max(...amounts)];
  const tickFormat = createUsdTickFormat(yDomain);
  const yTicks = computeYTicks(yDomain);
  marginLeft = computeMarginLeft(yDomain, tickFormat, yTicks);
  const plotChart = plot({
    width: chartWidth,
    height: chartHeight,
    marginLeft,
    marginRight,
    marginBottom,
    style: { fontSize: CHART_AXIS.fontSize },
    y: {
      grid: true,
      label: null,
      labelArrow: false,
      tickFormat,
      tickSize: 0,
      ticks: yTicks
    },
    x: {
      label: null,
      type: "time",
      tickSize: 0,
      ticks: CHART_AXIS.xTicks
    },
    marks: [
      line(data.value, {
        x: "date",
        y: "amount",
        stroke: "url(#gradient)",
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "catmull-rom",
        clip: "frame"
      })
    ]
  });

  plotContainer.appendChild(plotChart);

  // Build a data-driven gradient: green above zero, red below zero.
  // Inject it directly into the chart SVG so url(#gradient) resolves locally.
  const yScale = plotChart.scale("y");
  if (yScale) {
    const range = yScale.range as number[] | undefined;
    const plotBottom = range ? Math.max(...range) : chartHeight - marginBottom;
    const plotTop = range ? Math.min(...range) : 20;
    const zeroY = yScale.apply(0);
    const fraction =
      zeroY >= plotBottom ? 1 : zeroY <= plotTop ? 0 : (zeroY - plotTop) / (plotBottom - plotTop);

    const ns = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(ns, "defs");
    const grad = document.createElementNS(ns, "linearGradient");
    grad.setAttribute("id", "gradient");
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    grad.setAttribute("x1", "0");
    grad.setAttribute("y1", String(plotTop));
    grad.setAttribute("x2", "0");
    grad.setAttribute("y2", String(plotBottom));

    const stopDefs: [number, string][] = [
      [0, styles.getPropertyValue("--color-icon-success")],
      [fraction, styles.getPropertyValue("--color-icon-success")],
      [fraction, styles.getPropertyValue("--color-icon-error")],
      [1, styles.getPropertyValue("--color-icon-error")]
    ];
    for (const [offset, color] of stopDefs) {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", String(offset));
      stop.setAttribute("stop-color", color);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
    plotChart.prepend(defs);
  }

  const crosshair = select(plotChart)
    .append("line")
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.15)
    .attr("stroke-width", 1)
    .attr("y1", 0)
    .attr("y2", chartHeight - marginBottom)
    .style("display", "none");

  const dot = select(plotChart)
    .append("circle")
    .attr("r", 5)
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
        dot
          .attr("cx", xPixel)
          .attr("cy", yScale.apply(closestData.amount))
          .attr("fill", closestData.amount >= 0 ? "#19A96C" : "#DF294D")
          .style("display", null);

        tooltip.html(`<strong>${i18n.t("message.amount")}:</strong> ${formatUsd(closestData.amount)}`);

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
      dot.style("display", "none");
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  return findClosestPoint(data.value, (d) => d.date.getTime(), chartWidth, marginLeft, marginRight, cPosition);
}
</script>
<style lang="scss" scoped>
.btn-gradient {
  background: linear-gradient(270deg, #19a96c 0%, #df294d 100%);
}
</style>
