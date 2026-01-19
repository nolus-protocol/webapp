<template>
  <Widget>
    <template v-if="!disabled()">
      <div class="flex flex-col gap-4 md:flex-row md:gap-8">
        <BigNumber
          :label="$t('message.total-pnl')"
          :amount="{
            amount: pnl,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: NATIVE_CURRENCY.symbol,
            decimals: NORMAL_DECIMALS,
            fontSize: isMobile() ? 20 : 32
          }"
          :loading="loading"
        />
        <BigNumber
          :label="$t('message.volume')"
          :label-tooltip="{
            content: $t('message.volume-tooltip')
          }"
          :amount="{
            amount: tx_volume,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 20,
            decimals: NORMAL_DECIMALS
          }"
          :loading="loading"
        />
        <BigNumber
          :label="$t('message.win-rate')"
          :label-tooltip="{
            content: $t('message.win-rate-tooltip')
          }"
          :amount="{
            amount: win_rate,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: '%',
            fontSize: 20,
            decimals: NORMAL_DECIMALS,
            isDenomInfront: false
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
      :data-length="chart_data.length"
    />
  </Widget>
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import BigNumber from "@/common/components/BigNumber.vue";

import { barX, gridX, plot, ruleX } from "@observablehq/plot";
import { EtlApi, isMobile, WalletManager } from "@/common/utils";
import { select, pointer, type Selection } from "d3";
import { NATIVE_CURRENCY, NORMAL_DECIMALS } from "@/config/global";
import { Widget } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { ref, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";

const chartHeight = 125;
const marginTop = 0;
const marginBottom = 30;
const marginLeft = isMobile() ? 50 : 50;
const width = isMobile() ? 450 : 950;
const loading = ref(true);

const chart = ref<typeof Chart>();
const chart_data = ref<{ percentage: number; ticker: string; loan: string }[]>([]);
const wallet = useWalletStore();
const pnl = ref("0");
const tx_volume = ref("0");
const win_rate = ref("0");

type Data = {
  pnl: number;
  tx_volume: number;
  win_rate: string;
  bucket: {
    bucket: string;
    positions: number;
    share_percent: string;
  }[];
};

const disabled = () => (WalletManager.getWalletConnectMechanism() ? false : true);

watch(
  () => wallet.wallet,
  () => {
    setStats();
  }
);

async function setStats() {
  try {
    if (disabled()) {
      loading.value = false;
      chart.value?.update();
      return;
    }

    if (!disabled() && !wallet.wallet) {
      return;
    }
    const data = await fetch(`${EtlApi.getApiUrl()}/history-stats?address=${wallet.wallet?.address}`);
    const result: Data = await data.json();
    pnl.value = result.pnl.toString();
    tx_volume.value = result.tx_volume.toString();
    win_rate.value = result.win_rate.toString();

    chart_data.value = result.bucket.map((item) => {
      return {
        ticker: item.bucket,
        percentage: Number(item.share_percent),
        loan: item.positions.toString()
      };
    });
    loading.value = false;
    chart.value?.update();
  } catch (e) {
    loading.value = false;
    chart.value?.update();
  }
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  const bucketOrder = ["<0", "0-50", "51–100", "101–300", "301+"];
  plotContainer.innerHTML = "";

  const plotChart = plot({
    width,
    height: chartHeight,
    marginLeft,
    marginTop,
    marginBottom,
    style: { width: "100%" },
    x: { label: null },
    y: {
      label: null,
      domain: bucketOrder // force order
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

<style lang="scss">
.custom-tooltip {
  @apply absolute max-w-[200px] rounded border border-border-emphasized bg-neutral-bg-50 p-2 text-xs text-typography-default;
  pointer-events: none;
  transition: opacity 0.2s;
}
</style>
