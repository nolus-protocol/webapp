<template>
  <div class="flex flex-col items-center justify-center gap-y-4 self-center pb-4 text-center">
    <img
      v-if="image"
      v-bind="image"
      :src="`src/assets/icons/empty-state/${image.name}.png`"
      :srcset="`src/assets/icons/empty-state/${image.name}@2x.png 2x`"
      :class="['mx-auto w-full max-w-[255px] items-center object-contain', image.class]"
    />
    <span class="text-20 font-semibold text-typography-default">{{ title }}</span>
    <span class="text-14 font-normal text-typography-default">{{ description }}</span>
    <a
      v-if="link"
      :href="link.url"
      target="_blank"
      class="w-fit text-14 font-normal text-typography-link"
      >{{ link.label }}</a
    >
  </div>
</template>

<script lang="ts" setup>
import { type TooltipProps } from "web-components";

defineProps<{
  image?: { alt?: string; class?: string; style?: string; name: string };
  title: string;
  description: string;
  link?: { url: string; label: string; tooltip?: TooltipProps };
}>();
</script>

<style scoped lang=""></style>
