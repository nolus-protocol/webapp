<template>
  <div>
    <img
      :style="{ left: `${position}%` }"
      :src="icon"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { UtilizationProps } from "../types";

const props = defineProps<UtilizationProps>();
const percent = 65;

const position = computed(() => {
  return (percent * Number(props.value)) / 100;
});
</script>

<style lang="scss" scoped>
div {
  @apply relative h-[4px] w-[200px] rounded bg-neutral-bg-3;
  &::after {
    content: "";
    @apply absolute h-[4px] w-[35%] rounded bg-neutral-bg-3 bg-success-100;
    right: 0;
  }
  img {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
  }
}
</style>
