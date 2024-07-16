<template>
  <div
    :class="isWarning ? 'box-warning' : 'box-error'"
    class="box radius-rounded mb-6 flex items-start items-center break-words p-4 text-left"
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
      <p class="text-left text-14 font-normal">
        <slot name="content"></slot>
      </p>
    </div>
  </div>
</template>
<script lang="ts" setup>
defineProps({
  isWarning: {
    type: Boolean
  }
});
</script>
