<template>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { barX, gridX, plot, ruleX } from "@observablehq/plot";
import { AssetUtils, EtlApi, Logger } from "@/common/utils";

onMounted(async () => {
  await Promise.all([setStats()]).catch((e) => Logger.error(e));
});

const loans = ref<{ percentage: number; ticker: string }[]>([]);

async function setStats() {
  const data = await fetch(`${EtlApi.getApiUrl()}/leased-assets`);
  const items: { loan: string; asset: string }[] = await data.json();
  // const labels = [];
  // const dataValue = [];
  let total = 0;

  for (const i of items) {
    const currency = AssetUtils.getCurrencyByTicker(i.asset);
    total += Number(i.loan);
  }

  loans.value = items
    .map((item) => {
      const currency = AssetUtils.getCurrencyByTicker(item.asset);

      const loan = (Number(item.loan) / total) * 100;
      return {
        ticker: currency?.shortName ?? item.asset,
        percentage: loan
      };
    })
    .sort((a, b) => {
      return b.percentage - a.percentage;
    });

  // statChart.value?.updateChart(labels, colors, dataValue);
}
const chartHTML = computed(
  () =>
    plot({
      width: 960,
      height: 500,
      marginLeft: 60,
      style: {
        width: "100%"
      },
      x: {
        grid: true,
        percent: true,
        label: null
      },
      y: {
        label: null
      },
      marks: [
        ruleX([0]),
        barX(loans.value, {
          x: "percentage",
          y: "ticker",
          rx2: 2,
          fill: "#3470E2",
          sort: { y: "x", reverse: true }
        }),
        gridX({ stroke: "white", strokeOpacity: 0.5 })
      ]
    }).outerHTML
);
</script>
