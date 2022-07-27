<template>
<div :class="isWarning ? 'box-warning':'box-error'" class="flex items-center box  radius-rounded p-4 mb-6 text-left break-words">
  <div class="inline-block mr-2">
    <slot v-if="isWarning" name="icon"/>
    <i v-else class="icon icon-close"></i>
  </div>
  <div class="block box grow-1">
    <p class="text-left text-primary nls-14 nls-font-400">
      <slot name="content"/>
    </p>
  </div>
</div>
</template>
<script lang="ts">
export default {
  name: 'WarningBox',
  props: {
    isWarning: {
         type: Boolean
    }

  }
}
</script>
