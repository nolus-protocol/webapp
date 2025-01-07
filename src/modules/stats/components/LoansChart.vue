<template>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import loans from "./loans.json";
import * as Plot from "@observablehq/plot";

const chartHTML = Plot.plot({
  width: 960,
  height: 500,
  marginLeft: 60,
  x: {
    grid: true,
    percent: true,
    label: null
  },
  y: {
    label: null
  },
  marks: [
    Plot.ruleX([0]),
    Plot.barX(loans, {
      x: "percentage",
      y: "ticker",
      rx2: 2,
      fill: "#3470E2",
      sort: { y: "x", reverse: true }
    }),
    Plot.gridX({ stroke: "white", strokeOpacity: 0.5 })
  ]
}).outerHTML;
</script>

<style scoped lang=""></style>
