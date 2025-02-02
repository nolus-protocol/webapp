<template>
  <Chart
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot, ruleY } from "@observablehq/plot";
import { useI18n } from "vue-i18n";
import { pointer, select, type Selection } from "d3";
import { AssetUtils } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";

const data = [
  {
    amount: "4456.612",
    date: "2025-01-03T00:00:00Z"
  },
  {
    amount: "4736.26",
    date: "2025-01-07T00:00:00Z"
  },
  {
    amount: "3104.47",
    date: "2025-01-08T00:00:00Z"
  },
  {
    amount: "2680.74",
    date: "2025-01-14T00:00:00Z"
  },
  {
    amount: "2641.88",
    date: "2025-01-20T00:00:00Z"
  },
  {
    amount: "2078.23",
    date: "2025-02-01T00:00:00Z"
  },
  {
    amount: "1512.61",
    date: "2025-02-02T00:00:00Z"
  },
  {
    amount: "12512.61",
    date: "2025-03-02T00:00:00Z"
  }
].map((item) => {
  return {
    date: new Date(item.date),
    amount: Number(item.amount)
  };
});

const chartHeight = 250;
const marginLeft = 40;
const chartWidth = 960;
const marginRight = 30;
const marginBottom = 50;

const i18n = useI18n();

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = plot({
    color: { legend: true },
    style: { width: "100%" },
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginRight: marginRight,
    marginBottom: marginBottom,
    y: {
      type: "linear",
      grid: true,
      label: i18n.t("message.days-unrealized-pnL"),
      tickFormat: (d) => `$${d / 1e3}K`
    },
    x: { type: "time", label: i18n.t("message.date-capitalize") },
    marks: [
      lineY(data, {
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
          `<strong>${i18n.t("message.amount")}</strong> $${AssetUtils.formatNumber(closestData.amount, NATIVE_CURRENCY.maximumFractionDigits)}`
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
  const barWidth = plotAreaWidth / data.length;

  const barIndex = Math.floor(adjustedX / barWidth);

  if (barIndex >= 0 && barIndex < data.length) {
    return data[barIndex];
  }

  return null;
}

async function loadData() {}
</script>
