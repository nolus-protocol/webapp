<template>
  <div class="flex flex-col justify-between gap-y-2 lg:flex-row lg:gap-0">
    <div class="text-24 font-semibold text-typography-default">{{ title }}</div>
    <slot />
  </div>
</template>

<script lang="ts" setup>
const props = defineProps({
  title: {
    type: String,
    required: true
  }
});
</script>

<style scoped lang=""></style>
