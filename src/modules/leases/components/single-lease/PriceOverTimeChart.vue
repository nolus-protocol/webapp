<template>
  <Chart
    ref="chart"
    :updateChart="updateChart"
    :fns="[setData]"
    :getClosestDataPoint="getClosestDataPoint"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";

import type { LeaseData } from "@/common/types";
import { AssetUtils, EtlApi } from "@/common/utils";
import { CurrencyMapping } from "@/config/currencies";
import { NATIVE_CURRENCY, PERCENT, PositionTypes, ProtocolsConfig } from "@/config/global";
import { plot, lineY, ruleY } from "@observablehq/plot";
import { ref, watch } from "vue";
import { pointer, select, type Selection } from "d3";
import { useI18n } from "vue-i18n";
import { Dec } from "@keplr-wallet/unit";

type ChartData = { Date: Date; Price: number; Liquidation: number };

let data: ChartData[] = [];
const props = defineProps<{
  lease?: LeaseData;
  interval: string;
}>();
const chart = ref<typeof Chart>();
const i18n = useI18n();

const chartHeight = 250;
const marginLeft = 40;
const chartWidth = 960;
const marginRight = 30;
const marginBottom = 50;

const likert = {
  order: ["Price", "Liquidation"]
};

watch(
  () => [props.lease, props.interval],
  () => {
    setData();
  }
);

function liquidation() {
  const lease = props.lease?.leaseStatus?.opened;
  if (lease) {
    const price = props.lease.liquidation;
    const cPrice = getPrice()!;
    const diff = getDiff(price, cPrice)!;
    const percent = diff.quo(cPrice).mul(new Dec(PERCENT)).mul(new Dec(-1));
    return percent;
  }
  return new Dec(0);
}

function getDiff(price: Dec, cPrice: Dec) {
  switch (ProtocolsConfig[props.lease?.protocol!].type) {
    case PositionTypes.long: {
      return price.sub(cPrice);
    }
    case PositionTypes.short: {
      return cPrice.sub(price);
    }
  }
}

function getPrice() {
  switch (ProtocolsConfig[props.lease?.protocol!].type) {
    case PositionTypes.long: {
      return props.lease?.leaseData?.price;
    }
    case PositionTypes.short: {
      return props.lease?.leaseData?.lpnPrice;
    }
  }
}

async function setData() {
  if (props.lease) {
    const chartData = await loadData(props.interval);
    const liq = Number(liquidation().quo(new Dec(PERCENT)).toString());

    data = (chartData ?? []).map((item) => {
      const [date, price] = item;
      return {
        Date: new Date(date),
        Price: price,
        Liquidation: getLiquidationPrice(price, liq)!
      };
    });
    chart.value?.update();
  }
}

function getLiquidationPrice(price: number, liq: number) {
  const p = price * liq;

  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      return price - p;
    }
    case PositionTypes.short: {
      return price + p;
    }
  }
}

async function loadData(intetval: string) {
  switch (ProtocolsConfig[props.lease?.protocol!]?.type) {
    case PositionTypes.long: {
      let [key, protocol]: string[] = props.lease?.leaseData?.leasePositionTicker?.includes("@")
        ? props.lease!.leaseData.leasePositionTicker.split("@")
        : [props.lease?.leaseData?.leasePositionTicker as string, props.lease!.protocol];

      const ticker = CurrencyMapping[key]?.ticker ?? key;
      const prices = await EtlApi.fetchPriceSeries(ticker, protocol, intetval);

      return prices;
    }
    case PositionTypes.short: {
      const lpn = AssetUtils.getLpnByProtocol(props.lease?.protocol!);
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
      lineY(data, {
        x: "Date",
        y: "Price",
        stroke: "#3470E2",
        curve: "basis"
      }),
      lineY(data, {
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
          `<strong>${i18n.t("message.price")}:</strong> $${AssetUtils.formatNumber(closestData.Price, NATIVE_CURRENCY.maximumFractionDigits)}<br><strong>${i18n.t("message.chart-liquidation-tooltip")}:</strong> $${AssetUtils.formatNumber(closestData.Liquidation, NATIVE_CURRENCY.maximumFractionDigits)}`
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

  const barIndex = Math.floor(adjustedX / barWidth);

  if (barIndex >= 0 && barIndex < data.length) {
    return data[barIndex];
  }

  return null;
}
</script>
