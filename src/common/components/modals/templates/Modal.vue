<template>
  <Teleport to="body">
    <div
      class="background/70 modal-send-receive-parent fixed bottom-0 left-0 right-0 top-0 z-[999999999] flex justify-center"
      @keydown.esc="onModalClose"
      ref="dialog"
    >
      <button
        class="btn-close-modal"
        @click="onModalClose"
        v-if="!disable"
      >
        <XMarkIcon class="z-[5] inline-block h-8 w-8" />
      </button>
      <slot></slot>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, provide, ref } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/solid";
import { router } from "@/router";

const dialog = ref<HTMLDivElement>();
const props = defineProps({
  disableClose: {
    type: Boolean
  },
  route: {
    type: String,
    default: "dialog"
  }
});

const emit = defineEmits(["close-modal"]);
const disable = ref(false);

onMounted(() => {
  document.body.style.overflowY = "hidden";

  const element = dialog.value;
  if (element) {
    element.style.animation = "fadeInAnimation 200ms";
  }

  const path = router.currentRoute.value.path;
  router.push({
    path,
    hash: `#${props.route.toLowerCase()}`
  });
  document.addEventListener("keyup", escapeClicked);
  window.addEventListener("popstate", backButtonClicked);
});

onUnmounted(() => {
  document.removeEventListener("keyup", escapeClicked);
  window.removeEventListener("popstate", backButtonClicked);
});

function onModalClose() {
  if (!props.disableClose) {
    parseRoute();
    close();
  } else {
    emit("close-modal");
  }
}

function parseRoute() {
  const path = router.currentRoute.value.path;
  router.push({
    path
  });
}

function escapeClicked(event: KeyboardEvent) {
  if (event.key == "Escape" && !disable.value) {
    onModalClose();
  }
}

function backButtonClicked(event: Event) {
  close();
}

function close() {
  const element = dialog.value;
  if (element) {
    element.style.animation = "fadeOutAnimation 200ms";
  }
  setTimeout(() => {
    emit("close-modal");
    document.body.style.overflowY = "auto";
  }, 100);
}

function setDisable(bool: boolean) {
  disable.value = bool;
}

provide("onModalClose", onModalClose);
provide("parseRoute", parseRoute);
provide("setDisable", setDisable);

defineExpose({ onModalClose });
</script>
