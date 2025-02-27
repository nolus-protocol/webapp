<template>
  <div
    class="relative my-4"
    ref="container"
  >
    <div
      v-if="!disableSkeleton && isLoading"
      class="skeleton-loader absolute inset-0 flex items-end justify-center gap-1 rounded p-2"
    >
      <div
        v-for="n in numberOfBars"
        :key="n"
        class="blink bg-gray-300"
        :style="{ width: barWidth + 'px', height: randomHeight() }"
      ></div>
    </div>
    <div
      ref="plotContainer"
      class="flex items-center justify-center"
      :class="[{ 'opacity-0': isLoading && !disableSkeleton }]"
    ></div>
  </div>
</template>

<script lang="ts" setup>
import { select } from "d3";
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch } from "vue";
import { Logger } from "../utils";

export interface IChart {
  updateChart: Function;
  fns: Function[];
  getClosestDataPoint: Function;
  loader?: boolean;
  disableSkeleton?: boolean;
}

const tooltip = select("body").append("div").attr("class", "custom-tooltip").style("opacity", 0);
const props = defineProps<IChart>();
const isLoading = ref(true);
const maxHeight = ref(0);
const container = ref<HTMLDivElement | null>();
const numberOfBars = ref(0);
const barWidth = 10;

const plotContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  updateNumberOfBars();
  window.addEventListener("resize", updateNumberOfBars);

  await props.updateChart(plotContainer.value, tooltip);
  const items = props.fns.map((item) => item());
  await Promise.all(items).catch((e) => Logger.error(e));
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateNumberOfBars);
});

onUnmounted(() => {
  tooltip.remove();
});

function update() {
  props.updateChart(plotContainer.value, tooltip);
  isLoading.value = false;
}

watch(
  () => plotContainer.value,
  () => {
    const containerHeight = plotContainer.value?.clientHeight || 0;
    maxHeight.value = containerHeight - 50;
  }
);

function updateNumberOfBars() {
  if (container.value) {
    const containerWidth = container.value?.clientWidth;
    const totalBarWidth = barWidth;
    numberOfBars.value = Math.floor(containerWidth / totalBarWidth);
  }
}

function randomHeight() {
  const min = 10;
  const max = 50;
  return Math.floor(Math.random() * (max - min + 1) + min) + "%";
}

defineExpose({ update });
</script>

<style scoped lang="scss">
.skeleton-loader {
  animation: blink 1.5s linear infinite;
}

@keyframes blink {
  0%,
  100% {
    background-color: rgba(224, 224, 224, 0.6);
  }
  50% {
    background-color: rgba(224, 224, 224, 0.4);
  }
}
</style>
