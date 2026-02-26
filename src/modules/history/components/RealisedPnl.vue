<template>
  <Widget>
    <template v-if="!disabled()">
      <div class="flex flex-row flex-wrap gap-4 md:gap-8">
        <BigNumber
          :label="$t('message.total-pnl')"
          :amount="{
            value: pnl,
            denom: NATIVE_CURRENCY.symbol,
            decimals: NORMAL_DECIMALS,
            fontSize: 24,
            animatedReveal: true,
            compact: mobile
          }"
          :loading="loading"
        />
        <BigNumber
          :label="$t('message.volume')"
          :label-tooltip="{
            content: $t('message.volume-tooltip')
          }"
          :amount="{
            value: tx_volume,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 24,
            decimals: NORMAL_DECIMALS,
            animatedReveal: true,
            compact: mobile
          }"
          :loading="loading"
        />
        <BigNumber
          class="hidden md:block"
          :label="$t('message.win-rate')"
          :label-tooltip="{
            content: $t('message.win-rate-tooltip')
          }"
          :amount="{
            value: win_rate,
            denom: '%',
            fontSize: 24,
            decimals: NORMAL_DECIMALS,
            isDenomPrefix: false,
            animatedReveal: true
          }"
          :loading="loading"
        />
      </div>
      <div class="mt-2 flex flex-col">
        <span class="text-20 font-semibold text-typography-default">{{ $t("message.distribution") }}</span>
        <span class="mt-2 text-14 font-normal text-typography-default">{{ $t("message.pnl-count-percent") }}</span>
      </div>
    </template>

    <Chart
      ref="chart"
      :updateChart="updateChart"
      :fns="[setStats]"
      :getClosestDataPoint="getClosestDataPoint"
      :data-length="hasChartData ? chart_data.length : 0"
    />
  </Widget>
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import BigNumber from "@/common/components/BigNumber.vue";

import { barX, gridX, plot, ruleX } from "@observablehq/plot";
import { isMobile, WalletManager } from "@/common/utils";
import { CHART_AXIS, getChartWidth, computeMarginLeftForLabels } from "@/common/utils/ChartUtils";
import { select, pointer, type Selection } from "d3";
import { NATIVE_CURRENCY, NORMAL_DECIMALS } from "@/config/global";
import { Widget } from "web-components";
import { ref, watch, computed, onMounted } from "vue";
import { useAnalyticsStore } from "@/common/stores";

const mobile = isMobile();
const chartHeight = 125;
const marginTop = 0;
const marginBottom = 30;
let marginLeft: number;
let chartWidth: number;

const chart = ref<typeof Chart>();
const chart_data = ref<{ percentage: number; ticker: string; loan: string }[]>([]);
const analyticsStore = useAnalyticsStore();

const pnl = computed(() => analyticsStore.historyStats?.pnl?.toString() ?? "0");
const tx_volume = computed(() => analyticsStore.historyStats?.tx_volume?.toString() ?? "0");
const win_rate = computed(() => analyticsStore.historyStats?.win_rate?.toString() ?? "0");
const loading = computed(() => analyticsStore.historyDataLoading && !analyticsStore.hasHistoryData);

const hasChartData = computed(() => chart_data.value.some((d) => d.percentage !== 0));
const disabled = () => (WalletManager.getWalletConnectMechanism() ? false : true);

// Watch for history stats changes to update chart data
watch(
  () => analyticsStore.historyStats,
  (stats) => {
    if (stats?.bucket) {
      chart_data.value = stats.bucket.map((item: { bucket: string; positions: number; share_percent: string }) => {
        return {
          ticker: item.bucket,
          percentage: Number(item.share_percent),
          loan: item.positions.toString()
        };
      });
    }
    chart.value?.update();
  },
  { immediate: true }
);

onMounted(() => {
  setStats();
});

async function setStats() {
  if (disabled()) {
    chart.value?.update();
    return;
  }

  // Data will be fetched by analyticsStore when address is set
  // Just trigger chart update
  chart.value?.update();
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  const bucketOrder = ["<0", "0-50", "51–100", "101–300", "301+"];
  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);
  marginLeft = computeMarginLeftForLabels(bucketOrder);

  const plotChart = plot({
    width: chartWidth,
    height: chartHeight,
    marginLeft,
    marginTop,
    marginBottom,
    style: { fontSize: CHART_AXIS.fontSize },
    x: { label: null, ticks: CHART_AXIS.xTicks },
    y: {
      label: null,
      domain: bucketOrder, // force order
      ticks: CHART_AXIS.yTicks
    },
    marks: [
      ruleX([0]),
      barX(chart_data.value, {
        x: "percentage",
        y: "ticker",
        rx2: 2,
        fill: "#3470E2"
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
        tooltip.html(`<strong>${nearestData.ticker}:</strong> ${nearestData.loan}`);

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
  const barHeight = plotAreaHeight / chart_data.value.length;
  const barIndex = Math.floor(adjustedY / barHeight);

  if (barIndex >= 0 && barIndex < chart_data.value.length) {
    return chart_data.value[barIndex];
  }

  return null;
}
</script>
