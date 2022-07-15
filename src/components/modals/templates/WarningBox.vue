<template>
<div
      class="flex items-center box box-warning radius-rounded p-4 mb-nolus-24 text-left break-words"
    >
      <div class="inline-block mr-2">
        <slot name="icon"/>
      </div>
      <div class="block box box-warning grow-1">
        <p class="text-left text-primary nls-14 nls-font-400">
          <slot name="content"/>
        </p>

      </div>
    </div>
</template>
<script>
export default {
  name: 'WarningBox',

}
</script>
