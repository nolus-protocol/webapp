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
import { buildLiquidationSteps, computeChartLiquidationPrice, liquidationLabelFor } from "./liquidationLine";
import { formatPriceUsd, formatUsd } from "@/common/utils/NumberFormatUtils";
import {
  CHART_AXIS,
  createUsdTickFormat,
  computeMarginLeft,
  computeYTicks,
  findClosestPoint,
  getChartWidth
} from "@/common/utils/ChartUtils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import { plot, lineY } from "@observablehq/plot";
import { computed, ref, watch } from "vue";
import { pointer, select, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { useAnalyticsStore } from "@/common/stores";

const styles = window.getComputedStyle(document.documentElement);

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
  () => [props.lease?.address, props.lease?.status, props.interval],
  () => {
    void setData();
  }
);

const currency = computed(() => {
  const positionType = configStore.getPositionType(props.lease?.protocol as string);
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

    // Stepped historical trigger from ETL's per-event series when available;
    // otherwise the flat current value (shorts, missing data). See liquidationLine.ts.
    const steps = buildLiquidationSteps(props.lease.etl_data?.history);
    const active = props.lease.status === "opened";
    const flat = resolveLiquidationPrice();

    data.value = (chartData ?? [])
      .map((item) => {
        const [date, price] = item;
        const parsedDate = new Date(date);
        return {
          Date: parsedDate,
          Price: price,
          Liquidation: liquidationLabelFor(steps, flat, parsedDate.getTime(), active)
        };
      })
      .reverse();
    chart.value?.update();
  }
}

// Current liquidation trigger, resolved with the same decimals the position
// widgets use. Used as the flat fallback line when no per-event ETL series
// exists (shorts, missing data) — see liquidationLine.ts.
function resolveLiquidationPrice(): number {
  const protocolKey = props.lease?.protocol as string;
  const unitAssetInfo = configStore.currenciesData?.[`${props.lease?.amount.ticker}@${protocolKey}`];
  const lpn = getLpnByProtocol(protocolKey);
  const stableAssetInfo = lpn ? configStore.currenciesData?.[lpn.key] : null;

  return computeChartLiquidationPrice(props.lease, {
    positionType: configStore.getPositionType(protocolKey),
    unitDecimals: Number(unitAssetInfo?.decimal_digits ?? 0),
    stableDecimals: Number(stableAssetInfo?.decimal_digits ?? 0)
  });
}

async function loadData(intetval: string) {
  const positionType = configStore.getPositionType(props.lease?.protocol as string);
  const ticker = props.lease?.etl_data?.lease_position_ticker ?? props.lease?.amount?.ticker;

  if (positionType === "Long") {
    const [key, protocol]: string[] = ticker?.includes("@")
      ? ticker.split("@")
      : [ticker as string, props.lease?.protocol ?? ""];

    const prices = await analyticsStore.fetchPriceSeries(key, protocol, intetval);
    return prices;
  } else {
    const lpn = getLpnByProtocol(props.lease?.protocol as string);
    const [key, protocol] = lpn.key.split("@");
    const prices = await analyticsStore.fetchPriceSeries(key, protocol, intetval);
    return prices;
  }
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>) {
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

  // Include liquidation in domain only for the trigger values close enough to the
  // price range. When a trigger is far away (e.g. BTC at $67K, liquidation at $22K)
  // including it squashes the price line flat. A stepped series can span several
  // values, so we consider every visible trigger and keep those within 50% of the
  // mid-price — works for both Long (below) and Short (above).
  const midPrice = (minPrice + maxPrice) / 2;
  const liqValues = chartData
    .map((d) => (d.Liquidation === null ? NaN : Number(d.Liquidation)))
    .filter((v) => Number.isFinite(v) && v > 0);
  const inBand = midPrice > 0 ? liqValues.filter((v) => Math.abs(v - midPrice) / midPrice <= 0.5) : [];
  const includeLiq = inBand.length > 0;
  const domainMin = includeLiq ? Math.min(minPrice, ...inBand) : minPrice;
  const domainMax = includeLiq ? Math.max(maxPrice, ...inBand) : maxPrice;
  const range = domainMax - domainMin;
  const padding = range * 0.2 || domainMax * 0.05;
  const yDomain: [number, number] = [Math.max(0, domainMin - padding), domainMax + padding];
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
      // Not clamped: a liquidation far outside the price range is clipped to the
      // frame (invisible) rather than pinned to an edge at a position that would
      // contradict its tooltip value.
      clamp: false,
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
        stroke: styles.getPropertyValue("--color-primary-default"),
        strokeWidth: 2,
        strokeLinecap: "round",
        curve: "catmull-rom",
        clip: "frame"
      }),
      lineY(chartData, {
        x: "Date",
        y: "Liquidation",
        stroke: styles.getPropertyValue("--color-icon-brand"),
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeDasharray: "6, 4",
        // Discrete trigger: hold each value until the next event, then step.
        // Null rows (before open / after close) render as gaps, not a $0 line.
        curve: "step-after",
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

  const dotPrice = select(plotChart)
    .append("circle")
    .attr("r", 5)
    .attr("fill", styles.getPropertyValue("--color-primary-default"))
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .style("display", "none");

  const dotLiquidation = select(plotChart)
    .append("circle")
    .attr("r", 5)
    .attr("fill", styles.getPropertyValue("--color-icon-error"))
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .style("display", "none");

  select(plotChart)
    .on("mousemove", (event) => {
      const [x] = pointer(event, plotChart);

      const closestData = getClosestDataPoint(x);

      if (closestData) {
        const xScale = plotChart.scale("x");
        const yScale = plotChart.scale("y");
        if (!xScale || !yScale) return;
        const xPixel = xScale.apply(closestData.Date);

        crosshair.attr("x1", xPixel).attr("x2", xPixel).style("display", null);

        dotPrice.attr("cx", xPixel).attr("cy", yScale.apply(closestData.Price)).style("display", null);

        const liquidationValue = closestData.Liquidation !== null ? Number(closestData.Liquidation) : null;
        // Only place the liquidation dot when its value is inside the visible Y
        // domain; otherwise it would be pinned to an edge and contradict the
        // tooltip value.
        if (liquidationValue !== null && liquidationValue >= yDomain[0] && liquidationValue <= yDomain[1]) {
          dotLiquidation.attr("cx", xPixel).attr("cy", yScale.apply(liquidationValue)).style("display", null);
        } else {
          dotLiquidation.style("display", "none");
        }

        const liquidationHtml =
          liquidationValue !== null
            ? `<br><strong>${i18n.t("message.chart-liquidation-tooltip")}:</strong> ${formatUsd(liquidationValue)}`
            : "";
        tooltip.html(`<strong>${i18n.t("message.price")}:</strong> ${formatUsd(closestData.Price)}${liquidationHtml}`);

        const tooltipNode = tooltip.node();

        if (!tooltipNode) {
          return;
        }

        const node = tooltipNode.getBoundingClientRect();
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
      dotPrice.style("display", "none");
      dotLiquidation.style("display", "none");
      tooltip.style("opacity", 0);
    });
}

function getClosestDataPoint(cPosition: number) {
  return findClosestPoint(data.value, (d) => d.Date.getTime(), chartWidth, marginLeft, marginRight, cPosition);
}
</script>
