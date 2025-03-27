<template>
  <Chart
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
    ref="chart"
    :data-length="data_position.length"
  />
  <div
    v-if="chart?.isLegendVisible"
    class="flex justify-center"
  >
    <div class="flex items-center text-sm">
      <span class="m-2 block h-[4px] w-[12px] rounded bg-blue-500"></span>{{ $t("message.value-chart-label") }}
    </div>
    <div class="flex items-center text-sm">
      <span class="m-2 block h-[4px] w-[12px] rounded bg-red-500"></span>{{ $t("message.position-chart-label") }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot, ruleY } from "@observablehq/plot";
import { useI18n } from "vue-i18n";
import { pointer, select, type Selection } from "d3";
import { AssetUtils, EtlApi, isMobile } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { ref, watch } from "vue";

type ChartData = { position?: number; debt?: number; date: Date };

const data_position = ref<ChartData[]>([]);

const chartHeight = 250;
const marginLeft = 75;
const chartWidth = isMobile() ? 450 : 950;
const marginRight = 30;
const marginBottom = 50;

const i18n = useI18n();
const wallet = useWalletStore();
const chart = ref<typeof Chart>();

watch(
  () => wallet.wallet,
  () => {
    loadData();
  },
  { immediate: true }
);

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
      tickFormat: (d) => `${AssetUtils.formatNumber(d, NATIVE_CURRENCY.maximumFractionDigits, NATIVE_CURRENCY.symbol)}`
    },
    x: { type: "time", label: i18n.t("message.date-capitalize") },
    marks: [
      ruleY([0]),
      lineY(data_position.value, {
        x: "date",
        y: "position",
        stroke: "#3470E2",
        curve: "basis"
      }),
      lineY(data_position.value, {
        x: "date",
        y: "debt",
        stroke: "#FF5F3A",
        strokeDasharray: "3, 3",
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
          `<strong>${i18n.t("message.value-label")}</strong> ${AssetUtils.formatNumber(closestData?.position ?? 0, NATIVE_CURRENCY.maximumFractionDigits, NATIVE_CURRENCY.symbol)}
          <br>
          <strong>${i18n.t("message.debt-label")}</strong> ${AssetUtils.formatNumber(closestData?.debt ?? 0, NATIVE_CURRENCY.maximumFractionDigits, NATIVE_CURRENCY.symbol)}`
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

  if (data_position.value.length === 0) return null;

  // Scale `adjustedX` to match `data` range
  const maxDate = Math.max(...data_position.value.map((d) => d.date.getTime()));
  const minDate = Math.min(...data_position.value.map((d) => d.date.getTime()));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);

  // Convert adjustedX to the corresponding date value
  const targetDate = adjustedX / xScale + minDate;

  // Find the closest data point
  let closest = data_position.value[0];
  let minDiff = Math.abs(targetDate - closest.date.getTime());

  for (const point of data_position.value) {
    const diff = Math.abs(targetDate - point.date.getTime());
    if (diff < minDiff) {
      closest = point;
      minDiff = diff;
    }
  }

  return closest;
}

async function loadData() {
  if (wallet.wallet?.address) {
    const response = await EtlApi.fetchPositionDebtValue(wallet.wallet?.address);
    const data: { [key: string]: { position?: string; debt?: string } } = {};

    for (const item of response.position) {
      data[new Date(item.time).toISOString()] = { position: item.amount };
    }

    for (const item of response.debt) {
      const d = new Date(item.time).toISOString();
      if (data[d]) {
        data[d].debt = item.amount;
      } else {
        data[d] = { debt: item.amount };
      }
    }

    const dates = Object.keys(data)
      .map((item) => new Date(item))
      .sort((a, b) => a.getTime() - b.getTime());
    const items = [];
    for (const date of dates) {
      const d = data[date.toISOString()];
      items.push({
        date,
        debt: d?.debt ? Number(d?.debt) : undefined,
        position: d?.position ? Number(d?.position) : undefined
      });
    }
    data_position.value = items;
    chart.value?.update();
  }
}
</script>
