<template>
  <!-- <div class="flex items-center justify-end gap-3">
    <span>{{ $t("message.period") }}:</span>
    <Dropdown
      id="price"
      :on-select="
        (data) => {
          chartTimeRange = data;
        }
      "
      :options="options"
      :selected="options[0]"
      class="w-20"
      dropdownPosition="right"
      dropdownClassName="min-w-10"
    />
  </div> -->

  <div class="chart-container overflow-hidden">
    <div
      class="h-0"
      v-html="gradientHTML"
    ></div>
    <Chart
      :data-length="data.length"
      ref="chart"
      :updateChart="updateChart"
      :fns="[setData]"
      :getClosestDataPoint="getClosestDataPoint"
    />
  </div>
  <div
    class="flex justify-center"
    v-if="chart?.isLegendVisible"
  >
    <div class="flex items-center">
      <span class="btn-gradient m-2 block h-[8px] w-[20px] rounded"></span>
      {{ $t("message.pnl-in-usdc") }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { ref, watch } from "vue";
import { plot, line } from "@observablehq/plot";
import { pointer, select, type Selection } from "d3";

import { CHART_RANGES, NATIVE_CURRENCY } from "@/config/global";
import { useI18n } from "vue-i18n";
import { AssetUtils, EtlApi, isMobile } from "@/common/utils";
import type { LeaseData } from "@/common/types";

type ChartData = { amount: number; date: Date };

const chartHeight = 250;
const marginLeft = 60;
const chartWidth = isMobile() ? 350 : 550;
const marginRight = 30;
const marginBottom = 50;

const i18n = useI18n();
const chartTimeRange = ref(CHART_RANGES["1"]);
const options = Object.values(CHART_RANGES).map((value) => ({
  ...value,
  value: value.label
}));

const data = ref<ChartData[]>([
  {
    amount: 0,
    date: new Date(Date.now() - 1000 * 60 * 60)
  },
  {
    amount: 0,
    date: new Date()
  }
]);
const chart = ref<typeof Chart>();
const props = defineProps<{ lease?: LeaseData }>();

const gradientHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="502" height="83" viewBox="0 0 502 83" fill="none">
    <path d="M2 72.989L5.45833 66.431C8.91667 59.8729 15.8333 46.7567 22.75 43.9314C29.6667 41.1062 36.5833 48.5718 43.5 48.9533C50.4167 49.3347 57.3333 42.632 64.25 40.0367C71.1667 37.4415 78.0833 38.9538 85 39.9173C91.9167 40.8808 98.8333 41.2954 105.75 41.6473C112.667 41.9991 119.583 42.2881 126.5 44.7467C133.417 47.2053 136.015 48.9756 140.818 51.9772C146.42 55.4792 161.083 57.8929 168 59.9072C174.917 61.9214 181.833 69.2365 188.75 74.5013C195.667 79.7662 202.583 82.9808 209.5 79.4926C216.417 76.0044 223.333 65.8134 230.25 59.3473C237.167 52.8811 244.083 42.1353 251 34.1204C257.917 26.1054 264.833 12.8168 271.75 8.80582C278.667 4.79486 285.583 10.0615 292.5 9.13676C299.417 8.21198 306.333 1.09573 313.25 3.41014C320.167 5.72455 327.083 17.4696 334 19.3615C340.917 21.2534 347.833 13.2921 354.75 16.6045C361.667 19.9168 368.583 34.5027 375.5 42.1682C382.417 49.8338 389.333 50.5791 396.25 43.7787C403.167 36.9784 410.083 22.6325 417 19.5382C423.917 16.444 430.833 24.6014 437.75 28.6093C444.667 32.6172 451.583 32.4756 458.5 34.0334C465.417 35.5912 472.333 38.8484 479.25 37.269C486.167 35.6896 493.083 29.2737 496.542 26.0657L500 22.8577" stroke="url(#paint0_linear_16727_72849)" stroke-width="4" stroke-linecap="round"/>
    <defs>
    <linearGradient id="gradient" x1="258.47" y1="41.9716" x2="256.43" y2="72.8542" gradientUnits="userSpaceOnUse">
      <stop stop-color="#19A96C"/>
      <stop offset="1" stop-color="#DF294D"/>
    </linearGradient>
    </defs>
</svg>
`;

async function setData() {
  if (props.lease?.leaseAddress) {
    const response = await EtlApi.fetchPnlOverTime(props.lease?.leaseAddress, chartTimeRange.value.days);
    if (response.length > 0) {
      data.value = response.map((d) => ({
        date: new Date(d.date),
        amount: Number(d.amount)
      }));
    }
    chart.value?.update();
  }
}

watch(
  () => [props.lease, chartTimeRange.value],
  () => {
    setData();
  }
);

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = plot({
    width: chartWidth,
    height: chartHeight,
    marginLeft,
    marginRight,
    marginBottom,
    style: {
      width: "100%",
      height: "100%"
    },
    y: {
      grid: true,
      label: null,
      labelArrow: false,
      tickFormat: (d) => `${AssetUtils.formatNumber(d, NATIVE_CURRENCY.maximumFractionDigits, NATIVE_CURRENCY.symbol)}`,
      tickSize: 0
    },
    x: {
      label: null,
      type: "time",
      tickSize: 0,
      tickFormat: (d) => new Date(d).toLocaleString("default", { month: "short", year: "2-digit" })
    },
    marks: [
      line(data.value, {
        x: "date",
        y: "amount",
        stroke: "url(#gradient)",
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "basis"
      })
    ]
  });

  plotContainer.appendChild(plotChart);

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);

      const closestData = getClosestDataPoint(x);

      if (closestData) {
        tooltip.html(
          `<strong>${i18n.t("message.amount")}:</strong> ${AssetUtils.formatNumber(closestData.amount, NATIVE_CURRENCY.maximumFractionDigits, NATIVE_CURRENCY.symbol)}`
        );

        const node = tooltip.node()!.getBoundingClientRect();
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

  if (data.value.length === 0) return null;

  const maxDate = Math.max(...data.value.map((d) => d.date.getTime()));
  const minDate = Math.min(...data.value.map((d) => d.date.getTime()));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);

  const targetDate = adjustedX / xScale + minDate;
  let closest = data.value[0];
  let minDiff = Math.abs(targetDate - closest.date.getTime());

  for (const point of data.value) {
    const diff = Math.abs(targetDate - point.date.getTime());
    if (diff < minDiff) {
      closest = point;
      minDiff = diff;
    }
  }

  return closest;
}
</script>
<style lang="scss" scoped>
.btn-gradient {
  background: linear-gradient(270deg, #19a96c 0%, #df294d 100%);
}
</style>
