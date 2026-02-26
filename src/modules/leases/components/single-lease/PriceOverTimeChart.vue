<template>
  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[setData]"
    :getClosestDataPoint="getClosestDataPoint"
    :data-length="data.length"
  >
    <Tooltip :content="currency.price">
      <div class="flex items-center gap-2">
        <p class="text-16 font-semibold text-typography-default">
          {{ $t("message.latest") }}
        </p>
        <span class="text-16 text-typography-default"> 1 {{ currency.name }} = {{ currency.pretty_price }}</span>
      </div>
    </Tooltip>
  </Chart>
  <div
    v-if="chart?.isLegendVisible"
    class="flex justify-center"
  >
    <div class="flex items-center text-sm">
      <span class="m-2 block h-[4px] w-[12px] rounded bg-blue-500"></span>{{ $t("message.asset-price") }}
    </div>
    <div class="flex items-center text-sm">
      <span class="m-2 block h-[4px] w-[12px] rounded bg-red-500"></span>{{ $t("message.liquidation") }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { Tooltip } from "web-components";

import type { LeaseInfo } from "@/common/api";
import { LeaseUtils } from "@/common/utils";
import { formatPriceUsd, formatUsd } from "@/common/utils/NumberFormatUtils";
import {
  CHART_AXIS,
  createUsdTickFormat,
  computeMarginLeft,
  computeYTicks,
  getChartWidth
} from "@/common/utils/ChartUtils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import { plot, lineY } from "@observablehq/plot";
import { computed, ref, watch } from "vue";
import { pointer, select, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { Dec } from "@keplr-wallet/unit";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useAnalyticsStore } from "@/common/stores";

type ChartData = { Date: Date; Price: number; Liquidation: string | null };

const data = ref<ChartData[]>([]);
const props = defineProps<{
  lease?: LeaseInfo | null;
  interval: string;
}>();

const chart = ref<typeof Chart>();
const i18n = useI18n();
const configStore = useConfigStore();
const pricesStore = usePricesStore();
const analyticsStore = useAnalyticsStore();

const chartHeight = 250;
let chartWidth: number;
let marginLeft: number;
const marginRight = 30;
const marginBottom = 40;

const likert = {
  order: ["Price", "Liquidation"]
};

watch(
  () => [props.lease, props.interval],
  () => {
    setData();
  }
);

const currency = computed(() => {
  const positionType = configStore.getPositionType(props.lease?.protocol!);
  const ticker =
    positionType === "Short"
      ? props.lease?.debt?.ticker
      : (props.lease?.etl_data?.lease_position_ticker ?? props.lease?.amount?.ticker);
  const c = configStore.currenciesData?.[`${ticker}@${props.lease?.protocol}`];
  const price = pricesStore.prices[`${ticker}@${props.lease?.protocol}`];
  return {
    name: c?.shortName,
    price: price?.price ? formatPriceUsd(price?.price ?? 0) : "",
    pretty_price: price?.price ? formatPriceUsd(price?.price ?? 0) : ""
  };
});

async function setData() {
  if (props.lease) {
    const chartData = await loadData(props.interval);
    const liquidations = getLiquidations();
    data.value = (chartData ?? [])
      .map((item) => {
        const [date, price] = item;
        const now = new Date(date);

        const l = liquidations.reduce((closest, date) =>
          Math.abs(date.date.getTime() - now.getTime()) < Math.abs(closest.date.getTime() - now.getTime())
            ? date
            : closest
        );

        return {
          Date: now,
          Price: price,
          Liquidation: props.lease?.status === "opening" ? null : l.amount.toString()
        };
      })
      .reverse();
    chart.value?.update();
  }
}

function getLiquidations() {
  let asset = new Dec(0);
  let asset2 = new Dec(0);

  const liquidations: {
    amount: Dec;
    date: Date;
  }[] = [];

  const protocolKey = props.lease?.protocol!;

  if (props.lease?.status === "opened") {
    const historyElements = [...(props.lease?.etl_data?.history ?? [])].reverse();

    for (const history of historyElements) {
      const ticker = history.symbol;

      const unitAssetInfo = configStore.currenciesData![`${ticker!}@${protocolKey}`];
      if (unitAssetInfo) {
        asset = asset.add(new Dec(history.amount ?? "0", unitAssetInfo.decimal_digits));
      }

      const l = parceLiquidaitons(asset, asset2);
      liquidations.push({
        amount: l,
        date: new Date(history.timestamp ?? Date.now())
      });
    }
  }
  const l = parceLiquidaitons(new Dec(0), new Dec(0));
  liquidations.unshift({
    amount: l,
    date: new Date()
  });

  return liquidations;
}

function parceLiquidaitons(stableAdd: Dec, uAsset: Dec) {
  let liquidation = new Dec(0);
  if (props.lease?.status === "opened") {
    const protocolKey = props.lease?.protocol!;
    const ticker = props.lease?.amount.ticker;
    const unitAssetInfo = configStore.currenciesData![`${ticker!}@${protocolKey}`];
    const lpn = getLpnByProtocol(protocolKey);
    const stableAssetInfo = lpn ? configStore.currenciesData?.[lpn.key] : null;

    const unitAsset = new Dec(props.lease.amount.amount, Number(unitAssetInfo?.decimal_digits ?? 0));
    const stableAsset = new Dec(props.lease.debt.principal, Number(stableAssetInfo?.decimal_digits ?? 0));

    const positionType = configStore.getPositionType(protocolKey);
    if (positionType === "Long") {
      liquidation = LeaseUtils.calculateLiquidation(stableAsset.add(stableAdd), unitAsset.add(uAsset));
    } else {
      liquidation = LeaseUtils.calculateLiquidationShort(unitAsset.add(uAsset), stableAsset.add(stableAdd));
    }
  }

  return liquidation;
}

async function loadData(intetval: string) {
  const positionType = configStore.getPositionType(props.lease?.protocol!);
  const ticker = props.lease?.etl_data?.lease_position_ticker ?? props.lease?.amount?.ticker;

  if (positionType === "Long") {
    let [key, protocol]: string[] = ticker?.includes("@")
      ? ticker.split("@")
      : [ticker as string, props.lease!.protocol];

    const prices = await analyticsStore.fetchPriceSeries(key, protocol, intetval);
    return prices;
  } else {
    const lpn = getLpnByProtocol(props.lease?.protocol!);
    let [key, protocol] = lpn.key.split("@");
    const prices = await analyticsStore.fetchPriceSeries(key, protocol, intetval);
    return prices;
  }
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  chartWidth = getChartWidth(plotContainer);

  // Downsample to ~200 points for a smoother chart
  const maxPoints = 200;
  const chartData =
    data.value.length > maxPoints
      ? data.value.filter((_, i) => i % Math.ceil(data.value.length / maxPoints) === 0)
      : data.value;

  // Compute Y domain from price data only (liquidation may be far above/below)
  const prices = chartData.map((d) => d.Price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Include liquidation in domain
  const firstLiquidation = Number(chartData[0]?.Liquidation ?? 0);
  const allMin = firstLiquidation > 0 ? Math.min(minPrice, firstLiquidation) : minPrice;
  const allMax = firstLiquidation > 0 ? Math.max(maxPrice, firstLiquidation) : maxPrice;
  const range = allMax - allMin;
  const padding = range * 0.2 || allMax * 0.05;
  const yDomain: [number, number] = [Math.max(0, allMin - padding), allMax + padding];
  const tickFormat = createUsdTickFormat(yDomain);
  const yTicks = computeYTicks(yDomain);
  marginLeft = computeMarginLeft(yDomain, tickFormat, yTicks);

  const plotChart = plot({
    color: { domain: likert.order, legend: false },
    width: chartWidth,
    height: chartHeight,
    marginLeft,
    marginRight,
    marginBottom,
    style: { fontSize: CHART_AXIS.fontSize },
    y: {
      type: "linear",
      domain: yDomain,
      clamp: true,
      grid: true,
      label: null,
      labelArrow: false,
      tickFormat,
      tickSize: 0,
      ticks: yTicks
    },
    x: {
      label: null,
      type: "time",
      ticks: CHART_AXIS.xTicks
    },
    marks: [
      lineY(chartData, {
        x: "Date",
        y: "Price",
        stroke: "#3470E2",
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "catmull-rom",
        clip: "frame"
      }),
      lineY(chartData, {
        x: "Date",
        y: "Liquidation",
        stroke: "#FF5F3A",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeDasharray: "6, 4",
        curve: "catmull-rom",
        clip: "frame"
      })
    ]
  });

  plotContainer.appendChild(plotChart);

  const crosshair = select(plotChart)
    .append("line")
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.15)
    .attr("stroke-width", 1)
    .attr("y1", 0)
    .attr("y2", chartHeight - marginBottom)
    .style("display", "none");

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);

      const closestData = getClosestDataPoint(x);

      if (closestData) {
        crosshair.attr("x1", x).attr("x2", x).style("display", null);

        tooltip.html(
          `<strong>${i18n.t("message.price")}:</strong> ${formatUsd(closestData.Price)}<br><strong>${i18n.t("message.chart-liquidation-tooltip")}:</strong> ${formatUsd(Number(closestData.Liquidation!))}`
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
      crosshair.style("display", "none");
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  const plotAreaWidth = chartWidth - marginLeft - marginRight;
  const adjustedX = cPosition - marginLeft;

  if (data.value.length === 0) return null;

  const maxDate = Math.max(...data.value.map((d) => d.Date.getTime()));
  const minDate = Math.min(...data.value.map((d) => d.Date.getTime()));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);

  const targetDate = adjustedX / xScale + minDate;

  let closest = data.value[0];
  let minDiff = Math.abs(targetDate - closest.Date.getTime());

  for (const point of data.value) {
    const diff = Math.abs(targetDate - point.Date.getTime());
    if (diff < minDiff) {
      closest = point;
      minDiff = diff;
    }
  }

  return closest;
}
</script>
