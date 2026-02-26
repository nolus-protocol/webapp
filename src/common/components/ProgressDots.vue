<template>
  <div class="flex max-w-[120px] items-center">
    <template
      v-for="(_, index) in steps"
      :key="index"
    >
      <div
        :class="['h-2.5 w-2.5 shrink-0 rounded-full', index + 1 <= activeStep ? 'bg-green-400' : 'bg-neutral-500']"
      />
      <div
        v-if="index < steps - 1"
        :class="['h-[2px] flex-1', index + 1 < activeStep ? 'bg-green-400' : 'bg-neutral-500']"
      />
    </template>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  steps: number;
  activeStep: number;
}>();
</script>
