<template>
  <div
    class="fixed flex items-end md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[999999999] modal-send-receive-parent"
    style="linear-gradient(314.47 deg, #EBEFF5 2.19 %, #F7F9FC 100 %);">
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
