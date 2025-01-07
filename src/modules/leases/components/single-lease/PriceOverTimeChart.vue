<template>
  <div
    v-html="chartHTML"
    class="flex w-full items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { plot, lineY } from "@observablehq/plot";

const aapl = [
  { Date: "2020-01-01", Liquidation: 292.92, Close: 293.87 },
  { Date: "2020-01-02", Liquidation: 293.87, Close: 295.83 },
  { Date: "2020-01-03", Liquidation: 295.83, Close: 297.75 },
  { Date: "2020-02-07", Liquidation: 296.84, Close: 301 },
  { Date: "2020-02-08", Liquidation: 297.16, Close: 304.14 },
  { Date: "2020-03-09", Liquidation: 304.14, Close: 310.33 },
  { Date: "2020-03-10", Liquidation: 310.33, Close: 316.96 },
  { Date: "2020-04-13", Liquidation: 316.96, Close: 320.68 },
  { Date: "2020-04-14", Liquidation: 318.68, Close: 325.68 }
];

const likert = {
  order: ["Close", "Liquidation"]
};

const chartHTML = plot({
  color: { domain: likert.order, legend: false },
  width: 960,
  height: 350,
  style: {
    width: "100%",
    height: "100%"
  },
  y: {
    grid: true,
    label: null,
    labelArrow: false,
    tickFormat: (d) => `$${d}`,
    ticks: 4,
    tickSize: 0
  },
  x: {
    label: null,
    type: "time",
    ticks: 3,
    tickSize: 0,
    tickFormat: (d) => new Date(d).toLocaleString("default", { month: "short", year: "2-digit" })
  },
  marks: [
    lineY(aapl, {
      x: "Date",
      y: "Close",
      stroke: "#3470E2",
      strokeWidth: 4
    }),
    lineY(aapl, {
      x: "Date",
      y: "Liquidation",
      stroke: "#FF5F3A",
      strokeDasharray: "3, 3"
    })
  ]
}).outerHTML;
</script>

<style scoped lang=""></style>
