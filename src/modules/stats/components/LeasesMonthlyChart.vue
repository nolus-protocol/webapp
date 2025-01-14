<template>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { ref } from "vue";
import supply from "./supply.json";
import { rectY, ruleY, binX } from "@observablehq/plot";
import { timeMonth } from "d3-time";

const chartHTML = ref();

chartHTML.value = rectY(
  supply,
  // @ts-ignore
  binX({ y: "sum" }, { x: "lp_pool_timestamp", y: "borrowed", fill: "#19A96C", thresholds: timeMonth })
).plot({
  style: {
    width: "100%"
  },
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
  marks: [ruleY([0])]
}).outerHTML;
</script>

<style scoped lang=""></style>
