<template>
  <div class="flex justify-center">
    <div class="flex items-center">
      <span class="m-2 block h-[8px] w-[20px] rounded bg-green-400"></span>{{ $t("message.supplied") }}
    </div>
    <div class="flex items-center">
      <span class="m-2 block h-[8px] w-[20px] rounded bg-blue-500"></span>{{ $t("message.borrowed-chart") }}
    </div>
  </div>
  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot, ruleY } from "@observablehq/plot";
import { pointer, select, type Selection } from "d3";
import { AssetUtils, EtlApi } from "@/common/utils";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY } from "@/config/global";
import { ref } from "vue";

type ChartData = { date: Date; borrowed: number; supplied: number };

const chartHeight = 250;
const marginLeft = 40;
const chartWidth = 960;
const marginRight = 30;
const marginBottom = 50;

let data: ChartData[] = [];
const i18n = useI18n();
const chart = ref<typeof Chart>();

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
      ticks: 4,
      label: i18n.t("message.amount-$"),
      tickSize: 0,
      tickFormat: (d) => `$${d / 1e6}M`
    },
    x: { type: "time", label: i18n.t("message.date-capitalize") },
    marks: [
      ruleY([0]),
      lineY(data, {
        x: "date",
        y: "borrowed",
        stroke: "#3470E2",
        curve: "basis"
      }),
      lineY(data, {
        x: "date",
        y: "supplied",
        stroke: "#19A96C",
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
          `<strong>${i18n.t("message.supplied")}:</strong> $${AssetUtils.formatNumber(closestData.supplied, NATIVE_CURRENCY.maximumFractionDigits)}<br><strong>${i18n.t("message.borrowed-chart")}:</strong> $${AssetUtils.formatNumber(closestData.borrowed, NATIVE_CURRENCY.maximumFractionDigits)}`
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

  if (barIndex < 0) {
    return data.at(0);
  }

  if (barIndex > data.length - 1) {
    return data.at(-1);
  }

  return data[barIndex];
}

async function loadData() {
  const response = await EtlApi.fetchTimeSeries();
  data = response
    .map((d) => ({
      date: new Date(d.lp_pool_timestamp),
      borrowed: d.borrowed,
      supplied: d.supplied
    }))
    .reverse();
  console.log(data);

  chart.value?.update();
}
</script>

<style lang="scss">
.custom-tooltip {
  @apply absolute max-w-[200px] rounded border border-border-emphasized bg-neutral-bg-50 p-2 text-xs text-typography-default;
  pointer-events: none;
  transition: opacity 0.2s;
}
</style>
