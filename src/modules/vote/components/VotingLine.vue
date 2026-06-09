<template>
  <div class="flex">
    <Tooltip
      v-for="(segment, index) in segments"
      :key="segment.key"
      :content="tooltipContent(segment)"
    >
      <div
        :class="[colors[segment.key].bg, colors[segment.key].before, barClasses]"
        :style="{ width: `calc(${segment.percent}%)`, zIndex: segments.length - index }"
      />
    </Tooltip>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { Tooltip } from "web-components";
import type { FinalTallyResult } from "@/modules/vote/types";

const props = defineProps<{
  voting: FinalTallyResult;
  labels: Record<string, string>;
}>();

const colors: Record<string, { bg: string; before: string; text: string }> = {
  yes_count: { bg: "bg-success-100", before: "before:bg-success-100", text: "text-success-100" },
  abstain_count: { bg: "bg-neutral-200", before: "before:bg-neutral-200", text: "text-neutral-200" },
  no_count: { bg: "bg-danger-100", before: "before:bg-danger-100", text: "text-danger-100" },
  no_with_veto_count: { bg: "bg-blue-900", before: "before:bg-blue-900", text: "text-blue-900" }
};

const barClasses =
  "relative h-2.5 cursor-pointer first:rounded-md [&:not(:first-of-type)]:rounded-r-md [&:not(:first-of-type)]:before:absolute [&:not(:first-of-type)]:before:-left-[4px] [&:not(:first-of-type)]:before:h-2.5 [&:not(:first-of-type)]:before:w-[4px]";

const total = computed(() => Object.values(props.voting).reduce((acc, value) => acc + Number(value), 0));

const segments = computed(() =>
  Object.entries(props.voting)
    .map(([key, value]) => ({
      key,
      label: props.labels[key] ?? key,
      percent: ((Number(value) / total.value) * 100).toFixed(2)
    }))
    .filter((item) => !!Number(item.percent))
    .reverse()
);

function tooltipContent(segment: { key: string; label: string; percent: string }) {
  const textClass = colors[segment.key].text;
  return `<span class="${textClass}">${segment.label} ${segment.percent}%</span>`;
}
</script>
