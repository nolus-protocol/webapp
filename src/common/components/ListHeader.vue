<template>
  <div class="flex flex-col items-start justify-between gap-y-4 md:flex-row md:items-center md:gap-0">
    <h1 class="text-24 font-semibold text-typography-default">{{ title }}</h1>
    <div class="flex w-full gap-2 [&>*]:flex-1 md:w-auto md:[&>*]:flex-initial">
      <slot />
    </div>
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
