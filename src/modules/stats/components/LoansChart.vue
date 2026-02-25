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
import { isMobile } from "@/common/utils";
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import { CHART_AXIS, createUsdTickFormat, getChartWidth } from "@/common/utils/ChartUtils";
import { getCurrencyByTickerForNetwork } from "@/common/utils/CurrencyLookup";
import { select, pointer, type Selection } from "d3";
import { ref, watch } from "vue";
import { useConfigStore, useStatsStore } from "@/common/stores";

const mobile = isMobile();
const chartHeight = 500;
const marginTop = 20;
const marginBottom = 30;
const marginLeft = mobile ? 55 : 70;
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

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);

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
        fill: "#3470E2",
        sort: { y: "x", reverse: true }
      }),
      gridX({})
    ]
  });

  plotContainer.appendChild(plotChart);
  select(plotChart).selectAll("path").transition().duration(400).attr("opacity", 1);

  select(plotChart)
    .on("mousemove", (event) => {
      const [x, y] = pointer(event, plotChart);

      const nearestData = getClosestDataPoint(y);
      if (nearestData) {
        tooltip.html(
          `<strong>${nearestData.ticker}:</strong> ${formatUsd(nearestData.loan)}`
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

