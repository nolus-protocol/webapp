<template>
  <div class="flex">
    <div
      v-for="(res, index) in result"
      :key="index"
      :class="[colors[res.label].bg, colors[res.label].before]"
      :style="{
        width: `calc(${res.percent}%)`,
        zIndex: result.length - index
      }"
      class="relative h-2.5 cursor-pointer first:rounded-md [&:not(:first-of-type)]:rounded-r-md [&:not(:first-of-type)]:before:absolute [&:not(:first-of-type)]:before:-left-[4px] [&:not(:first-of-type)]:before:h-2.5 [&:not(:first-of-type)]:before:w-[4px]"
      @mouseleave="hideTooltip(index)"
      @mouseover="showTooltip(index)"
    >
      <div
        v-show="showTooltips[index]"
        class="absolute -top-[100%] left-[50%] flex translate-x-[-50%] translate-y-[calc(-50%-10px)] gap-1 rounded-md border-[#C1CAD7] bg-white p-2 text-[8px] font-medium"
      >
        <span
          :class="[colors[res.label].text]"
          class="font-bold uppercase"
          >{{ $t(`message.${res.label}`) }}</span
        >
        {{ res.percent }}%
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, type PropType, ref } from "vue";
import type { FinalTallyResult } from "@/modules/vote/types";

const props = defineProps({
  voting: {
    type: Object as PropType<FinalTallyResult>,
    required: true
  }
});

const showTooltips = ref(Array(Object.values(props.voting).length).fill(false));

const colors: { [key: string]: any } = {
  yes_count: {
    bg: "bg-[#1AB171]",
    before: "before:bg-[#1AB171]",
    text: "text-[#1AB171]"
  },
  abstain_count: {
    bg: "bg-[#C1CAD7]",
    before: "before:bg-[#C1CAD7]",
    text: "text-[#C1CAD7]"
  },
  no_count: {
    bg: "bg-[#E42929]",
    before: "before:bg-[#E42929]",
    text: "text-[#E42929]"
  },
  no_with_veto_count: {
    bg: "bg-[#082D63]",
    before: "before:bg-[#082D63]",
    text: "text-[#082D63]"
  }
};

const total = computed(() => Object.values(props.voting).reduce((acc, value) => acc + Number(value), 0));
const result = computed(() =>
  Object.entries(props.voting)
    .reduce(
      (acc, [key, value]) => {
        acc.push({
          label: key,
          percent: ((Number(value) / total.value) * 100).toFixed(2)
        });

        return acc;
      },
      [] as { label: string; percent: string }[]
    )
    .filter((item) => !!Number(item.percent))
    .reverse()
);

const showTooltip = (index: number) => {
  showTooltips.value[index] = true;
};

const hideTooltip = (index: number) => {
  showTooltips.value[index] = false;
};
</script>

<style lang="scss" scoped></style>
