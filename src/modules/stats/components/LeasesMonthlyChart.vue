<template>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { ref } from "vue";
import * as Plot from "@observablehq/plot";
import supply from "./supply.json";
import * as d3Time from "d3-time";

const chartHTML = ref();

chartHTML.value = Plot.rectY(
  supply,
  // @ts-ignore
  Plot.binX({ y: "sum" }, { x: "lp_pool_timestamp", y: "borrowed", fill: "#19A96C", thresholds: d3Time.timeMonth })
).plot({
  width: 960,
  height: 250,
  marginLeft: 70,
  marginBottom: 50,
  color: { legend: true },
  y: {
    type: "linear",
    label: "Leases monthly ($)",
    tickFormat: (d) => `$${d / 1e6}M`
  },
  x: { label: null, interval: "months" },
  marks: [Plot.ruleY([0])]
}).outerHTML;
</script>

<style scoped lang=""></style>
