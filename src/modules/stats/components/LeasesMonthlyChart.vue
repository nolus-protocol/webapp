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
import {
  CHART_AXIS,
  createUsdTickFormat,
  computeMarginLeft,
  computeYTicks,
  getChartWidth
} from "@/common/utils/ChartUtils";
import { color, select, pointer, timeMonth, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { ref, watch } from "vue";
import { useStatsStore } from "@/common/stores";

const props = defineProps<{
  period: string;
}>();

const styles = window.getComputedStyle(document.documentElement);

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

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);

  const amounts = loans.value.map((d) => d.amount);
  const yDomain: [number, number] = [Math.min(0, ...amounts), Math.max(...amounts)];
  const tickFormat = createUsdTickFormat(yDomain);
  const yTicks = computeYTicks(yDomain);
  marginLeft = computeMarginLeft(yDomain, tickFormat, yTicks);

  const plotChart = rectY(
    loans.value,
    // @ts-expect-error -- Observable Plot binX typing mismatch with rectY options
    binX(
      { y: "sum" },
      { x: "date", y: "amount", fill: styles.getPropertyValue("--color-icon-success"), thresholds: timeMonth }
    )
  ).plot({
    style: { fontSize: CHART_AXIS.fontSize },
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginBottom: marginBottom,
    marginRight: marginRight,
    y: {
      grid: true,
      type: "linear",
      label: null,
      tickFormat,
      ticks: yTicks
    },
    x: { label: null, interval: "months", ticks: CHART_AXIS.xTicks },
    marks: [ruleY([0])]
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

  const baseColor = styles.getPropertyValue("--color-icon-success").trim();
  const hoverColor = color(baseColor)?.brighter(0.4)?.formatHex() ?? baseColor;

  const rects = select(plotChart).selectAll("rect").attr("rx", 3).attr("ry", 3);

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);
      const closestData = getClosestDataPoint(x);
      if (closestData) {
        const barWidth = (chartWidth - marginLeft - marginRight) / loans.value.length;
        const barIndex = Math.floor((x - marginLeft) / barWidth);
        rects.attr("fill", baseColor);
        const barEl = rects
          .filter((_, i) => i === barIndex)
          .attr("fill", hoverColor)
          .node() as Element | null;
        if (barEl) {
          const bx = +barEl.getAttribute("x")! + +barEl.getAttribute("width")! / 2;
          crosshair.attr("x1", bx).attr("x2", bx).style("display", null);
        }

        tooltip.html(`<strong>${i18n.t("message.amount")}</strong> ${formatUsd(closestData.amount)}`);
        const node = tooltip.node()!.getBoundingClientRect();
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - node.width / 2}px`)
          .style("top", `${event.pageY - node.height - 10}px`);
      }
    })
    .on("mouseleave", () => {
      rects.attr("fill", baseColor);
      crosshair.style("display", "none");
      tooltip.style("opacity", 0);
    });
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
