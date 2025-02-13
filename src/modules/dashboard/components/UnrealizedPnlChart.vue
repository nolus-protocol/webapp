<template>
  <Chart
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
    ref="chart"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot } from "@observablehq/plot";
import { useI18n } from "vue-i18n";
import { pointer, select, type Selection } from "d3";
import { AssetUtils, EtlApi } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { ref } from "vue";
import type { IObjectKeys } from "@/common/types";

type ChartData = { amount: number; date: Date };

let data: ChartData[] = [
  {
    amount: 0,
    date: new Date(Date.now() - 1000 * 60 * 60)
  },
  {
    amount: 0,
    date: new Date()
  }
];

const chartHeight = 250;
const marginLeft = 40;
const chartWidth = 960;
const marginRight = 30;
const marginBottom = 50;

const i18n = useI18n();
const wallet = useWalletStore();
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
      label: i18n.t("message.days-unrealized-pnL")
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
  const barIndex = Math.floor(adjustedX / barWidth) + 1;

  if (barIndex < 0) {
    return data.at(0);
  }

  if (barIndex > data.length - 1) {
    return data.at(-1);
  }

  return data[barIndex];
}

async function loadData() {
  if (wallet.wallet?.address) {
    const response = await EtlApi.fetchUnrealizedByAddressPnl(wallet.wallet?.address);

    data = response.map((d: IObjectKeys) => ({
      date: new Date(d.date),
      amount: Number(d.amount)
    }));
    chart.value?.update();
  }
}
</script>
