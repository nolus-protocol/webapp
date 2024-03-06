<template>
  <div
    :class="isWarning ? 'box-warning' : 'box-error'"
    class="box radius-rounded mb-6 flex items-start break-words p-4 text-left"
  >
    <div class="mr-2 inline-block">
      <slot
        v-if="isWarning"
        name="icon"
      ></slot>
      <i
        v-else
        class="icon icon-close"
      ></i>
    </div>
    <div class="box grow-1 block">
      <p class="nls-font-400 text-left text-14">
        <slot name="content"></slot>
      </p>
    </div>
  </div>
</template>
<script setup lang="ts">
defineProps({
  isWarning: {
    type: Boolean
  }
});
</script>
