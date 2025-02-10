<script lang="ts" setup>
import { ref, computed } from "vue";
import { Dropdown } from "web-components";
import * as Plot from "@observablehq/plot";

import { CHART_RANGES } from "@/config/global";

const chartTimeRange = ref(CHART_RANGES["1"]);

const options = Object.values(CHART_RANGES).map((value) => ({
  ...value,
  value: value.label
}));

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

// SVG Gradient за плавно преливане между два цвята
const gradientHTML = `
  <svg width="0" height="0">
    <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#EF4444; stop-opacity:1" />
        <stop offset="50%" style="stop-color:#FACC15; stop-opacity:1" />
        <stop offset="100%" style="stop-color:#34D399; stop-opacity:1" />
      </linearGradient>
    </defs>
  </svg>
`;

const chartHTML = computed(
  () =>
    Plot.plot({
      width: 960,
      height: 350,
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
        Plot.line(aapl, {
          x: "Date",
          y: "Close",
          stroke: "url(#gradient)", // Градиентен цвят
          strokeWidth: 4,
          strokeLinecap: "round" // За плавни краища
        })
      ]
    }).outerHTML
);
</script>

<template>
  <div class="chart-container">
    <div v-html="gradientHTML"></div>
    <div
      v-html="chartHTML"
      class="flex items-center justify-center"
    />
  </div>
</template>
