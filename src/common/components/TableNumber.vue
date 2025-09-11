<template>
  <Tooltip :content="tooltip">
    <div class="flex flex-col">
      <div class="flex justify-end">{{ value }}</div>
      <div class="flex flex-1 text-12 font-normal">{{ subValue }}</div>
    </div>
  </Tooltip>
</template>

<script lang="ts" setup>
import { Tooltip } from "web-components";
defineProps<{
  value: string;
  subValue: string;
  tooltip: string;
}>();
</script>
