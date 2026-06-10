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

// Reacts to: statsStore.monthlyLeases (polled store data).
// Idempotency: rebuilds the local loans series from the response each fire and
// repaints the chart; safe to re-fire.
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

// Reacts to: props.period (user-selected range from parent).
// Side effect: setStats() fetches monthly leases for the new period. Idempotency:
// each fire issues one fetch for the current period; the store replaces its data.
watch(
  () => props.period,
  () => setStats()
);

async function setStats() {
  await statsStore.fetchMonthlyLeases(props.period);
}

function isTooltipSelection(value: unknown): value is Selection<HTMLDivElement, unknown, HTMLElement, unknown> {
  return value instanceof Object && "html" in value && "style" in value && "node" in value;
}

function updateChart(plotContainer: unknown, tooltip: unknown) {
  if (!(plotContainer instanceof HTMLElement) || !isTooltipSelection(tooltip)) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);

  const amounts = loans.value.map((d) => d.amount);
  const yDomain: [number, number] = [Math.min(0, ...amounts), Math.max(...amounts)];
  const tickFormat = createUsdTickFormat(yDomain);
  const yTicks = computeYTicks(yDomain);
  marginLeft = computeMarginLeft(yDomain, tickFormat, yTicks);

  const plotChart = rectY(
    loans.value,
    binX(
      { y: "sum" },
      // @ts-expect-error -- Observable Plot's BinXInputs omits the y input channel consumed by the sum reducer
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
          const bx = +(barEl.getAttribute("x") ?? 0) + +(barEl.getAttribute("width") ?? 0) / 2;
          crosshair.attr("x1", bx).attr("x2", bx).style("display", null);
        }

        tooltip.html(`<strong>${i18n.t("message.amount")}</strong> ${formatUsd(closestData.amount)}`);
        const tooltipNode = tooltip.node();
        if (!tooltipNode) {
          return;
        }
        const node = tooltipNode.getBoundingClientRect();
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

function getClosestDataPoint(cPosition: unknown) {
  if (typeof cPosition !== "number") {
    return null;
  }
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
