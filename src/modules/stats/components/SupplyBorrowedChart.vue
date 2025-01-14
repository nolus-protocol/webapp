<template>
  <div
    v-html="lineChartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import type { IObjectKeys } from "@/common/types";
import { computed, onMounted, ref } from "vue";
import { lineY, plot, ruleY } from "@observablehq/plot";
import { EtlApi } from "@/common/utils";

const data = ref<IObjectKeys[]>([]);

onMounted(async () => {
  await loadData();
});

const loadData = async () => {
  const response = await EtlApi.fetchTimeSeries();
  data.value = response.map((d: IObjectKeys) => {
    return {
      date: new Date(d.lp_pool_timestamp).toLocaleDateString("en-CA"),
      supplied: d.supplied,
      borrowed: d.borrowed
    };
  });
};

const lineChartHTML = computed(
  () =>
    plot({
      color: {
        legend: true
      },
      style: {
        width: "100%"
      },
      width: 960,
      height: 250,
      y: {
        type: "linear",
        grid: true,
        ticks: 4,
        label: "Amount ($)",
        tickSize: 0,
        tickFormat: (d) => `$${d / 1e6}M`
      },
      x: {
        type: "time"
      },

      marks: [
        ruleY([0]),
        lineY(data.value, {
          x: "date",
          y: "borrowed",
          stroke: "#3470E2"
        }),
        lineY(data.value, {
          x: "date",
          y: "supplied",
          stroke: "#19A96C",
          tip: true
        })
      ]
    }).outerHTML
);
</script>

<style scoped lang=""></style>
