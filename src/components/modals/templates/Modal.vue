<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center z-[999999999] modal-send-receive-parent"
    >
    <button class="btn-close-modal" @click="onModalClose">
      <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg" />
    </button>
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { provide } from 'vue'

const emit = defineEmits(['close-modal'])

function onModalClose () {
  emit('close-modal')
}

provide('onModalClose', onModalClose)
</script>
