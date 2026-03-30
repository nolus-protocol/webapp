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
import { barX, gridX, plot, ruleX } from "@observablehq/plot";
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import { CHART_AXIS, createUsdTickFormat, computeMarginLeftForLabels, getChartWidth } from "@/common/utils/ChartUtils";
import { getCurrencyByTickerForNetwork } from "@/common/utils/CurrencyLookup";
import { color, select, pointer, type Selection } from "d3";
import { ref, watch } from "vue";
import { useConfigStore, useStatsStore } from "@/common/stores";

const styles = window.getComputedStyle(document.documentElement);
const chartHeight = 400;
const marginTop = 0;
const marginBottom = 30;
let marginLeft: number;
let chartWidth: number;

const chart = ref<typeof Chart>();
const loans = ref<{ ticker: string; loan: number }[]>([]);
const configStore = useConfigStore();
const statsStore = useStatsStore();

// Watch both leasedAssets and configStore.initialized — currency names
// require the config store to be populated for friendly name resolution
watch(
  [() => statsStore.leasedAssets, () => configStore.initialized],
  ([items]) => {
    if (items) {
      processLeasedAssets(items as { loan: string; asset: string }[]);
    }
  },
  { immediate: true }
);

function processLeasedAssets(items: { loan: string; asset: string }[]) {
  loans.value = items
    .map((item) => {
      const [key, protocol] = item.asset.split(" ");
      let shortName = key;
      try {
        const currency = getCurrencyByTickerForNetwork(key);
        shortName = currency?.shortName ?? key;
      } catch {
        // Currency not found in registry, use ticker as-is
      }

      return {
        ticker: `${shortName}${protocol ? ` ${protocol}` : ""}`,
        loan: Number(item.loan)
      };
    })
    .sort((a, b) => b.loan - a.loan);

  chart.value?.update();
}

async function setStats() {
  // Data is now fetched by statsStore, just trigger a refresh if needed
  if (!statsStore.leasedAssets) {
    await statsStore.fetchLeasedAssets();
  }
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);
  marginLeft = computeMarginLeftForLabels(loans.value.map((d) => d.ticker)) + 10;

  const loanValues = loans.value.map((d) => d.loan);
  const xDomain: [number, number] = [0, Math.max(...loanValues)];
  const tickFormat = createUsdTickFormat(xDomain);

  const plotChart = plot({
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginTop: marginTop,
    marginBottom: marginBottom,
    style: { fontSize: CHART_AXIS.fontSize },
    x: {
      label: null,
      tickFormat,
      ticks: CHART_AXIS.xTicks
    },
    y: {
      label: null,
      ticks: CHART_AXIS.yTicks
    },
    marks: [
      ruleX([0]),
      barX(loans.value, {
        x: "loan",
        y: "ticker",
        rx2: 2,
        fill: styles.getPropertyValue("--color-primary-default"),
        sort: { y: "x", reverse: true }
      }),
      gridX({})
    ]
  });

  plotContainer.appendChild(plotChart);
  select(plotChart).selectAll("path").transition().duration(400).attr("opacity", 1);

  const crosshair = select(plotChart)
    .append("line")
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.15)
    .attr("stroke-width", 1)
    .attr("x1", marginLeft)
    .attr("x2", chartWidth)
    .style("display", "none");

  const baseColor = "#3470E2";
  const hoverColor = color(baseColor)?.brighter(0.4)?.formatHex() ?? baseColor;

  const rects = select(plotChart).select('g[aria-label="bar"]').selectAll("path");

  select(plotChart)
    .on("mousemove", (event) => {
      const [_x, y] = pointer(event, plotChart);
      const nearestData = getClosestDataPoint(y);
      if (nearestData) {
        const plotAreaHeight = chartHeight - marginTop - marginBottom;
        const barHeightPx = plotAreaHeight / loans.value.length;
        const barIndex = Math.floor((y - marginTop) / barHeightPx);
        const by = marginTop + (barIndex + 0.5) * barHeightPx;
        crosshair.attr("y1", by).attr("y2", by).style("display", null);

        rects.style("fill", null);
        rects.filter((_, i) => i === barIndex).style("fill", hoverColor);

        tooltip.html(`<strong>${nearestData.ticker}:</strong> ${formatUsd(nearestData.loan)}`);
        const node = tooltip.node()!.getBoundingClientRect();
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - node.width / 2}px`)
          .style("top", `${event.pageY - node.height - 10}px`);
      }
    })
    .on("mouseleave", () => {
      rects.style("fill", null);
      crosshair.style("display", "none");
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(yPosition: number) {
  const plotAreaHeight = chartHeight - marginTop - marginBottom;
  const adjustedY = yPosition - marginTop;
  const barHeight = plotAreaHeight / loans.value.length;
  const barIndex = Math.floor(adjustedY / barHeight);

  if (barIndex >= 0 && barIndex < loans.value.length) {
    return loans.value[barIndex];
  }

  return null;
}
</script>
