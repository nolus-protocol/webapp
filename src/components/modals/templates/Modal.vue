<template>
  <div
    class="fixed flex top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[999999999] modal-send-receive-parent"
    style="linear-gradient(314.47 deg, #EBEFF5 2.19 %, #F7F9FC 100 %);"
    @keydown.esc="onModalClose"
  >
    <button class="btn-close-modal" @click="onModalClose">
      <img class="inline-block w-5 h-5 z-[5]" src="@/assets/icons/cross.svg" />
    </button>
    <slot></slot>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, provide } from 'vue';
import router from '@/router';

const props = defineProps({
  route: {
    type: String,
    default: 'dialog'
  }
})

const emit = defineEmits(['close-modal']);

const onModalClose = () => {
  parseRoute();
  emit('close-modal');
  document.body.style.overflowY = 'auto';
};

const parseRoute = () => {
  const path = router.currentRoute.value.path;
  router.push({
    path,
  });
};

const escapeClicked = (event: KeyboardEvent) => {
  if (event.key == 'Escape') {
    onModalClose();
  }
};

const backButtonClicked = (event: Event) => {
  emit('close-modal');
};

onMounted(() => {
  const path = router.currentRoute.value.path;
  router.push({
    path,
    hash: `#${props.route.toLowerCase()}`,
  });
  document.addEventListener('keyup', escapeClicked);
  window.addEventListener('popstate', backButtonClicked);
  document.body.style.overflowY = 'hidden';
});

onUnmounted(() => {
  document.removeEventListener('keyup', escapeClicked);
  window.removeEventListener('popstate', backButtonClicked);
});

provide('onModalClose', onModalClose);
provide('parseRoute', parseRoute);
</script>
<style scoped>
button.btn-close-modal{
  padding: 16px;
  z-index: 99;
}
</style>