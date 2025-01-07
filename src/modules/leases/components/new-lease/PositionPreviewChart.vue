<template>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { plot, barY, axisX, text, ruleY } from "@observablehq/plot";

const responses = [
  { name: "Borrowed + taxes", value: 130, ticker: "330,65 OSMO", price: "$129.763124" },
  { name: "Down payment", value: 200, ticker: "~50.559 ATOM", price: "~$249,47" }
];

const chartHTML = plot({
  className: "position-preview-chart",
  y: { label: null, ticks: 3, tickFormat: (d) => `$${d}`, tickSize: 0, line: true },
  marks: [
    axisX({ label: null, marginBottom: 40, tickSize: 0, fontSize: 16 }),
    barY([responses[1]], {
      x: "name",
      y: "value",
      fill: "#C1CAD7",
      rx: 6,
      insetBottom: -3,
      clip: "frame"
    }),
    barY([responses[0]], { x: "name", y: "value", fill: "#19A96C", rx: 6, insetBottom: -3, clip: "frame" }),
    text(responses, {
      x: "name",
      y: "value",
      dy: 30,
      fontSize: 14,
      text(d) {
        return `${d.price} \n ${d.ticker}`;
      }
    }),
    ruleY([0])
  ]
}).outerHTML;
</script>

<style lang="scss">
.position-preview-chart {
  @apply text-typography-default;
}
</style>
