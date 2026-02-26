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

const colors: Record<string, { bg: string; before: string; hex: string }> = {
  yes_count: { bg: "bg-[#1AB171]", before: "before:bg-[#1AB171]", hex: "#1AB171" },
  abstain_count: { bg: "bg-[#C1CAD7]", before: "before:bg-[#C1CAD7]", hex: "#C1CAD7" },
  no_count: { bg: "bg-[#E42929]", before: "before:bg-[#E42929]", hex: "#E42929" },
  no_with_veto_count: { bg: "bg-[#082D63]", before: "before:bg-[#082D63]", hex: "#082D63" }
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
  const color = colors[segment.key].hex;
  return `<span style="color:${color}">${segment.label} ${segment.percent}%</span>`;
}
</script>
