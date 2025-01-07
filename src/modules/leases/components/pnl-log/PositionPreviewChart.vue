<template>
  <div class="flex items-center justify-between text-typography-default">
    <span class="text-16 font-semibold">{{ $t("message.pnl-over-time") }}</span>
  </div>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { line } from "@observablehq/plot";

const aapl = [
  { Date: "2020-01-01", Close: 292.92 },
  { Date: "2020-01-02", Close: 293.87 },
  { Date: "2020-01-03", Close: 295.83 },
  { Date: "2020-01-06", Close: 297.75 },
  { Date: "2020-02-07", Close: 296.84 },
  { Date: "2020-02-08", Close: 297.16 },
  { Date: "2020-03-09", Close: 304.14 },
  { Date: "2020-03-10", Close: 310.33 },
  { Date: "2020-04-13", Close: 316.96 },
  { Date: "2020-04-14", Close: 312.68 }
];

const chartHTML = line(aapl, { x: "Date", y: "Close", stroke: "#3470E2", strokeWidth: 4 }).plot({
  width: 960,
  height: 350,
  style: {
    width: "100%"
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
  }
}).outerHTML;
</script>

<style scoped lang=""></style>
