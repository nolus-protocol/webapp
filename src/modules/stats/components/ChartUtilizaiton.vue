<template>
  <div class="parent">
    <div
      class="absolute right-0 h-[4px] rounded bg-success-100"
      :style="{ width: `${100 - Number(deposit)}%` }"
    ></div>
    <img
      :style="{ left: `${position}%` }"
      :src="icon"
      alt=""
    />
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { UtilizationProps } from "../types";

const props = defineProps<UtilizationProps>();
const position = computed(() => props.value);
</script>

<style lang="scss" scoped>
.parent {
  @apply relative h-[4px] w-[200px] rounded bg-neutral-bg-3;

  img {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
  }
}
</style>
