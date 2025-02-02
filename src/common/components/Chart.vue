<template>
  <div
    ref="plotContainer"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import { select } from "d3";
import { onMounted, onUnmounted, ref } from "vue";
import { Logger } from "../utils";

export interface IChart {
  updateChart: Function;
  fns: Function[];
  getClosestDataPoint: Function;
}

const tooltip = select("body").append("div").attr("class", "custom-tooltip").style("opacity", 0);
const props = defineProps<IChart>();
const plotContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  props.updateChart(plotContainer.value, tooltip);
  const items = props.fns.map((item) => item());
  await Promise.all(items).catch((e) => Logger.error(e));
  props.updateChart(plotContainer.value, tooltip);
});

onUnmounted(() => {
  tooltip.remove();
});
</script>
