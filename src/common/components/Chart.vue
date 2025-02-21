<template>
  <div class="relative my-4">
    <div
      v-if="isLoading"
      class="skeleton-loader absolute z-10 flex h-full w-full justify-center gap-2.5 border-gray-600 p-6"
    >
      <div
        v-for="item in 10"
        :key="item"
        :style="{ height: `${Math.random() * maxHeight}px` }"
        class="w-10 self-end bg-icon-link"
      ></div>
    </div>
    <div
      ref="plotContainer"
      class="flex items-center justify-center"
      :class="[{ 'opacity-0': isLoading }]"
    ></div>
  </div>
</template>

<script lang="ts" setup>
import { select } from "d3";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { Logger } from "../utils";

export interface IChart {
  updateChart: Function;
  fns: Function[];
  getClosestDataPoint: Function;
  loader?: boolean;
}

const tooltip = select("body").append("div").attr("class", "custom-tooltip").style("opacity", 0);
const props = defineProps<IChart>();
const isLoading = ref(true);
const maxHeight = ref(0);

const plotContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  await props.updateChart(plotContainer.value, tooltip);
  const items = props.fns.map((item) => item());
  await Promise.all(items).catch((e) => Logger.error(e));
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

defineExpose({ update });
</script>

<style scoped lang="scss">
.skeleton-loader {
  animation: blink 1.5s linear infinite;
}

@keyframes blink {
  0%,
  100% {
    background-color: #ccc;
  }
  50% {
    background-color: rgba(224, 224, 224, 0.8);
  }
}
</style>
