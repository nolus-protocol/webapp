<template>
  <DialogHeader :headerList="[title]">
    <div
      class="overflow-auto md:max-h-[70vh] text-primary p-10 custom-scroll proposal-modal"
      v-html="description"
    />
  </DialogHeader>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true
  }
})

const description = computed(() => {
  const source = props.source?.replace(/(?:\\[rn])+/g, '\n')

  return marked.parse(source, {
    pedantic: false,
    gfm: true,
    breaks: true
  })
})
</script>

<style lang="scss">
.proposal-modal {
  @apply text-left;

  h1 {
    margin-bottom: 0.5rem;
    font-weight: 500;
    line-height: 1.2;
    color: #5e5873;
  }
}
</style>
