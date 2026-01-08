<template>
  <div class="flex flex-col justify-between items-center gap-y-2 lg:flex-row lg:gap-0">
    <h1 class="text-24 font-semibold text-typography-default">{{ title }}</h1>
    <slot />
  </div>
</template>

<script lang="ts" setup>
defineProps({
  title: {
    type: String,
    required: true
  }
});
</script>

<style scoped lang=""></style>
