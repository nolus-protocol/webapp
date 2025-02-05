<template>
  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[setStats]"
    :getClosestDataPoint="getClosestDataPoint"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { binX, rectY, ruleY } from "@observablehq/plot";
import { AssetUtils, EtlApi } from "@/common/utils";
import { select, pointer, timeMonth, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY } from "@/config/global";
import { ref } from "vue";

const chartHeight = 300;
const chartWidth = 1000;
const marginBottom = 50;
const marginLeft = 30;
const marginRight = 30;
const chart = ref<typeof Chart>();

const i18n = useI18n();
let loans: { amount: number; date: Date }[] = [];

async function setStats() {
  const response = await EtlApi.fetchLeaseMonthly();
  loans = response
    .map((d) => ({
      date: new Date(d.date),
      amount: d.amount
    }))
    .reverse();

  chart.value?.update();
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = rectY(
    loans,
    // @ts-ignore
    binX({ y: "sum" }, { x: "date", y: "amount", fill: "#19A96C", thresholds: timeMonth })
  ).plot({
    style: {
      width: "100%"
    },
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginBottom: marginBottom,
    marginRight: marginRight,
    color: { legend: true },
    y: {
      type: "linear",
      label: i18n.t("message.leases-monthly"),
      tickFormat: (d) => `$${d / 1e6}M`
    },
    x: { label: null, interval: "months" },
    marks: [ruleY([0])]
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

        const node = tooltip?.node()!.getBoundingClientRect();
        const height = node.height;
        const width = node.width;
        tooltip
          .style("opacity", 1)
          .style("left", `${event.pageX - width / 2}px`)
          .style("top", `${event.pageY - height - 10}px`);
      }
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  const plotAreaWidth = chartWidth - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;
  const barWidth = plotAreaWidth / loans.length;

  const barIndex = Math.floor(adjustedX / barWidth);

  if (barIndex >= 0 && barIndex < loans.length) {
    return loans[barIndex];
  }

  return null;
}
</script>
