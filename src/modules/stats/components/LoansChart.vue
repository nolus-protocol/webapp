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
import { AssetUtils, EtlApi, isMobile } from "@/common/utils";
import { select, pointer, type Selection } from "d3";
import { ref } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";
const chartHeight = 500;
const marginTop = 20;
const marginBottom = 30;
const marginLeft = isMobile() ? 50 : 100;
const width = isMobile() ? 450 : 950;

const chart = ref<typeof Chart>();
const loans = ref<{ percentage: number; ticker: string; loan: string }[]>([]);

async function setStats() {
  const data = await fetch(`${EtlApi.getApiUrl()}/leased-assets`);
  const items: { loan: string; asset: string }[] = await data.json();
  let total = 0;

  for (const i of items) {
    total += Number(i.loan);
  }

  loans.value = items
    .map((item) => {
      const [key, protocol] = item.asset.split(" ");
      let shortName = key;
      try {
        const currency = AssetUtils.getCurrencyByTicker(key);
        shortName = currency?.shortName ?? key;
      } catch {
        // Currency not found in registry, use ticker as-is
      }

      const loan = (Number(item.loan) / total) * 100;
      return {
        ticker: `${shortName}${protocol ? ` ${protocol}` : ""}`,
        percentage: loan,
        loan: item.loan
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  chart.value?.update();
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";

  const plotChart = plot({
    width,
    height: chartHeight,
    marginLeft: marginLeft,
    marginTop: marginTop,
    marginBottom: marginBottom,
    style: {
      width: "100%"
    },
    x: {
      percent: true,
      label: null
    },
    y: {
      label: null
    },
    marks: [
      ruleX([0]),
      barX(loans.value, {
        x: "percentage",
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
          `<strong>${nearestData.ticker}:</strong> $${AssetUtils.formatNumber(nearestData.loan, NATIVE_CURRENCY.maximumFractionDigits)}`
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

<style lang="scss">
.custom-tooltip {
  @apply absolute max-w-[200px] rounded border border-border-emphasized bg-neutral-bg-50 p-2 text-xs text-typography-default;
  pointer-events: none;
  transition: opacity 0.2s;
}
</style>
