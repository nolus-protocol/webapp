<template>
  <div
    :class="isWarning ? 'box-warning' : 'box-error'"
    class="flex items-center box radius-rounded p-4 mb-6 text-left break-words"
  >
    <div class="inline-block mr-2">
      <slot v-if="isWarning" name="icon"></slot>
      <i v-else class="icon icon-close"></i>
    </div>
    <div class="block box grow-1">
      <p class="text-left text-14 nls-font-400">
        <slot name="content"></slot>
      </p>
    </div>
  </div>
</template>
<script setup lang="ts">
defineProps({
  isWarning: {
    type: Boolean,
  },
});
</script>
