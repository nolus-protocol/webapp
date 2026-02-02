<template>
  <div class="flex">
    <div class="flex flex-1 justify-center">
      <div class="flex items-center">
        <span class="m-2 block h-[8px] w-[20px] rounded bg-green-400"></span>{{ $t("message.supplied") }}
      </div>
      <div class="flex items-center">
        <span class="m-2 block h-[8px] w-[20px] rounded bg-blue-500"></span>{{ $t("message.borrowed-chart") }}
      </div>
    </div>

    <div class="flex items-center gap-3">
      <span>{{ $t("message.period") }}:</span>
      <Dropdown
        id="period"
        :on-select="
          (data) => {
            chartTimeRange = data;
            loadData();
          }
        "
        :options="options"
        :selected="options[0]"
        class="w-20"
        dropdownPosition="right"
        dropdownClassName="min-w-10"
      />
    </div>
  </div>

  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
    :data-length="data.length"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot, ruleY } from "@observablehq/plot";
import { pointer, select, type Selection } from "d3";
import { isMobile } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY } from "@/config/global";
import { ref, watch } from "vue";
import { Dropdown } from "web-components";
import { useStatsStore } from "@/common/stores";

type ChartData = { date: Date; borrowed: number; supplied: number };

const chartHeight = 250;
const marginLeft = 40;
const chartWidth = isMobile() ? 450 : 950;
const marginRight = 30;
const marginBottom = 50;

const data = ref<ChartData[]>([]);
const i18n = useI18n();
const chart = ref<typeof Chart>();
const statsStore = useStatsStore();

// Watch for supplyBorrowHistory changes from store
watch(
  () => statsStore.supplyBorrowHistory,
  (response) => {
    if (response && response.length > 0) {
      data.value = response
        .map((d) => ({
          date: new Date(d.lp_pool_timestamp as string),
          borrowed: d.borrowed as number,
          supplied: d.supplied as number
        }))
        .reverse();
      chart.value?.update();
    }
  },
  { immediate: true }
);

const options = ref([
  { label: `3${i18n.t("message.month_abr")}`, value: "3m" },
  { label: `6${i18n.t("message.month_abr")}`, value: "6m" },
  { label: `12${i18n.t("message.month_abr")}`, value: "12m" },
  { label: i18n.t("message.all"), value: "all" }
]);

const chartTimeRange = ref(options.value[0]);

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
      lineY(data.value, {
        x: "date",
        y: "borrowed",
        stroke: "#3470E2",
        curve: "basis"
      }),
      lineY(data.value, {
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
          `<strong>${i18n.t("message.supplied")}:</strong> $${formatNumber(closestData.supplied, NATIVE_CURRENCY.maximumFractionDigits)}<br><strong>${i18n.t("message.borrowed-chart")}:</strong> $${formatNumber(closestData.borrowed, NATIVE_CURRENCY.maximumFractionDigits)}`
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

  if (data.value.length === 0) return null;

  // Scale `adjustedX` to match `loans` range
  const maxDate = Math.max(...data.value.map((d) => d.date.getTime()));
  const minDate = Math.min(...data.value.map((d) => d.date.getTime()));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);

  // Convert adjustedX to the corresponding date value
  const targetDate = adjustedX / xScale + minDate;

  // Find the closest loans point
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

async function loadData() {
  // Fetch with the current time range
  await statsStore.fetchSupplyBorrowHistory(chartTimeRange.value.value);
}
</script>

<style lang="scss">
.custom-tooltip {
  @apply absolute max-w-[200px] rounded border border-border-emphasized bg-neutral-bg-50 p-2 text-xs text-typography-default;
  pointer-events: none;
  transition: opacity 0.2s;
}
</style>
