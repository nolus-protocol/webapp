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
  position: relative;
  height: 4px;
  width: 200px;
  border-radius: 0.25rem;
  background-color: var(--color-background-level-3);

  img {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
  }
}
</style>
