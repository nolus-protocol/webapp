<template>
  <DialogHeader :headerList="title">
    <div class="overflow-auto md:max-h-[70vh] text-primary p-10 custom-scroll">
      {{ description }}
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: string,
    required: true
  }
})
</script>

<style lang="scss" scoped></style>
