<template>
  <Chart
    :updateChart="updateChart"
    :fns="[loadData]"
    :getClosestDataPoint="getClosestDataPoint"
    ref="chart"
    :disableSkeleton="true"
    :data-length="5"
  />
</template>

<script lang="ts" setup>
import Chart from "@/common/components/Chart.vue";
import { lineY, plot } from "@observablehq/plot";
import { useI18n } from "vue-i18n";
import { pointer, select, type Selection } from "d3";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY, PERCENT } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { computed, ref, watch } from "vue";
import { Dec, Int } from "@keplr-wallet/unit";
import { useApplicationStore } from "@/common/stores/application";

type ChartData = { amount: number; date: number };

const data = ref<ChartData[]>([]);

const period = 7;

const chartHeight = 250;
const marginLeft = 50;
const chartWidth = 400;
const marginRight = 30;
const marginBottom = 65;
const marginTop = 50;

const i18n = useI18n();
const wallet = useWalletStore();
const app = useApplicationStore();
const chart = ref<typeof Chart>();
const props = defineProps<{ amount: Dec; currencyKey: string }>();

const currency = computed(() => {
  return app.currenciesData![props.currencyKey];
});

watch(
  () => [wallet?.apr, props.amount, currency.value],
  () => {
    loadData();
  },
  {
    immediate: true
  }
);

function updateChart(plotContainer: HTMLElement, tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any>) {
  if (!plotContainer) return;

  plotContainer.innerHTML = "";
  const plotChart = plot({
    color: { legend: true },
    style: { width: "100%" },
    marginTop,
    width: chartWidth,
    height: chartHeight,
    marginLeft: marginLeft,
    marginRight: marginRight,
    marginBottom: marginBottom,
    y: {
      type: "linear",
      grid: true,
      label: i18n.t("message.earn-chart-y"),
      round: true
    },
    x: { ticks: 9, tickRotate: 15, type: "linear", tickFormat: (d) => `${d}y.` },
    marks: [
      lineY(data.value, {
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
          `<strong>${i18n.t("message.amount")}</strong> ${formatNumber(closestData.amount, NATIVE_CURRENCY.maximumFractionDigits)} ${currency.value?.shortName}`
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

  const maxDate = Math.max(...data.value.map((d) => d.date));
  const minDate = Math.min(...data.value.map((d) => d.date));
  const xScale = plotAreaWidth / (maxDate - minDate || 1);
  const targetDate = adjustedX / xScale + minDate;

  let closest = data.value[0];
  let minDiff = Math.abs(targetDate - closest.date);

  for (const point of data.value) {
    const diff = Math.abs(targetDate - point.date);
    if (diff < minDiff) {
      closest = point;
      minDiff = diff;
    }
  }

  return closest;
}

async function loadData() {
  let apr = new Dec(getApr(props.currencyKey) ?? 0);
  data.value = [];
  if (apr.isZero()) {
    data.value = [];
  } else {
    let amount = props.amount;
    const value = [];
    for (let i = 0; i <= period; i++) {
      let b = new Dec(1).add(apr).pow(new Int(i));
      let a = amount.mul(b);
      value.push({
        amount: Number(a.toString(2)),
        date: i
      });
    }

    data.value = value;
  }
  chart.value?.update();
}

function getApr(key: string) {
  let [_, protocol] = key.split("@");
  return (app.apr?.[protocol] ?? 0) / PERCENT;
}
</script>
