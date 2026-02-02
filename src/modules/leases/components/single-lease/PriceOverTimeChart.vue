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
import { EtlApi, isMobile, LeaseUtils } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";
import { MAX_DECIMALS, NATIVE_CURRENCY, PositionTypes, ProtocolsConfig } from "@/config/global";
import { plot, lineY, ruleY } from "@observablehq/plot";
import { computed, ref, watch } from "vue";
import { pointer, select, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { Dec } from "@keplr-wallet/unit";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";

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

const chartHeight = 250;
const marginLeft = 50;
const chartWidth = isMobile() ? 350 : 950;
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
  const ticker = props.lease?.etl_data?.lease_position_ticker ?? props.lease?.amount?.ticker;
  const c = configStore.currenciesData?.[`${ticker}@${props.lease?.protocol}`];
  const price = pricesStore.prices[`${ticker}@${props.lease?.protocol}`];
  return {
    name: c?.shortName,
    price: price?.price
      ? `${NATIVE_CURRENCY.symbol}${formatNumber(price?.price ?? 0, c?.decimal_digits)}`
      : "",
    pretty_price: price?.price
      ? `${NATIVE_CURRENCY.symbol}${formatNumber(price?.price ?? 0, MAX_DECIMALS)}`
      : ""
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
    
    switch (ProtocolsConfig[protocolKey]?.type) {
      case PositionTypes.long: {
        liquidation = LeaseUtils.calculateLiquidation(stableAsset.add(stableAdd), unitAsset.add(uAsset));
        break;
      }
      case PositionTypes.short: {
        liquidation = LeaseUtils.calculateLiquidationShort(unitAsset.add(uAsset), stableAsset.add(stableAdd));
        break;
      }
    }
  }

  return liquidation;
}

async function loadData(intetval: string) {
  const posType = ProtocolsConfig[props.lease?.protocol!]?.type;
  const ticker = props.lease?.etl_data?.lease_position_ticker ?? props.lease?.amount?.ticker;
  
  switch (posType) {
    case PositionTypes.long: {
      let [key, protocol]: string[] = ticker?.includes("@")
        ? ticker.split("@")
        : [ticker as string, props.lease!.protocol];

      const prices = await EtlApi.fetchPriceSeries(key, protocol, intetval);
      return prices;
    }
    case PositionTypes.short: {
      const lpn = getLpnByProtocol(props.lease?.protocol!);
      let [key, protocol] = lpn.key.split("@");
      const prices = await EtlApi.fetchPriceSeries(key, protocol, intetval);
      return prices;
    }
  }
}

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = plot({
    color: { domain: likert.order, legend: false },
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
      type: "linear",
      grid: true,
      label: null,
      labelArrow: false,
      tickFormat: (d) => `$${d}`,
      ticks: 4,
      tickSize: 0
    },
    x: {
      label: null,
      type: "time"
    },
    marks: [
      ruleY([0]),
      lineY(data.value, {
        x: "Date",
        y: "Price",
        stroke: "#3470E2",
        curve: "basis"
      }),
      lineY(data.value, {
        x: "Date",
        y: "Liquidation",
        stroke: "#FF5F3A",
        strokeDasharray: "3, 3",
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
          `<strong>${i18n.t("message.price")}:</strong> $${formatNumber(closestData.Price, NATIVE_CURRENCY.maximumFractionDigits)}<br><strong>${i18n.t("message.chart-liquidation-tooltip")}:</strong> $${formatNumber(closestData.Liquidation!, NATIVE_CURRENCY.maximumFractionDigits)}`
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
