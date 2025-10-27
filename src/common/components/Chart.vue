<template>
  <div
    class="relative my-4"
    ref="container"
  >
    <slot></slot>
    <div
      v-if="!disableSkeleton && isLoading"
      class="absolute h-full w-full"
    >
      <div class="flex h-full w-full flex-col items-center justify-center">
        <span class="mb-2 justify-center text-14 text-typography-default">{{ $t("message.loading-data") }}</span>
        <Spinner
          height="20"
          width="20"
        />
      </div>
    </div>

    <template v-else>
      <EmptyState
        v-if="dataLength < minLength"
        :slider="[
          {
            image: { name: 'no-results-found', class: 'max-h-[150px]' },
            title: $t('message.no-chartdata'),
            description: $t('message.no-chartdata-description')
          }
        ]"
      />
    </template>

    <div
      ref="plotContainer"
      class="flex items-center justify-center"
      :class="[{ 'opacity-0': isLoading && !disableSkeleton, hidden: !isLoading && dataLength < minLength }]"
    ></div>
  </div>
</template>

<script lang="ts" setup>
import { select } from "d3";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Logger } from "../utils";
import { Spinner } from "web-components";
import { useI18n } from "vue-i18n";
import EmptyState from "@/common/components/EmptyState.vue";

export interface IChart {
  updateChart: Function;
  fns: Function[];
  getClosestDataPoint: Function;
  loader?: boolean;
  disableSkeleton?: boolean;
  dataLength: number;
}

const minLength = 3;
const tooltip = select("body").append("div").attr("class", "custom-tooltip").style("opacity", 0);
const props = defineProps<IChart>();
const isLoading = ref(true);
const maxHeight = ref(0);
const container = ref<HTMLDivElement | null>();
const plotContainer = ref<HTMLElement | null>(null);
const i18n = useI18n();

onMounted(async () => {
  await props.updateChart(plotContainer.value, tooltip);
  const items = props.fns.map((item) => item());
  await Promise.all(items).catch((e) => Logger.error(e));
});

onUnmounted(() => {
  tooltip.remove();
});

watch(i18n.locale, async () => {
  try {
    await props.updateChart(plotContainer.value, tooltip);
  } catch (e) {
    console.error(e);
  }
});

const isLegendVisible = computed(() => {
  return !(!isLoading.value && props.dataLength < minLength);
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

defineExpose({ update, isLegendVisible });
</script>
