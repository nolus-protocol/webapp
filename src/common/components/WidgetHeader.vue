<template>
  <div class="flex flex-col justify-between gap-5 lg:flex-row 2xl:gap-0">
    <div class="flex items-center gap-2">
      <SvgIcon
        v-if="icon"
        size="l"
        v-bind="icon"
      />
      <span class="text-20 font-semibold text-typography-default">{{ label }}</span>
      <Badge
        v-if="badge"
        v-bind="badge"
      />
    </div>
    <slot />
  </div>
</template>

<script lang="ts" setup>
import type { IBadgeProps, SvgProps } from "web-components";
import { Badge, SvgIcon } from "web-components";
import type { Component } from "vue";

const props = defineProps<{
  icon?: SvgProps & Component;
  label: string;
  badge?: IBadgeProps & Component;
}>();
</script>

<style scoped lang="scss"></style>
