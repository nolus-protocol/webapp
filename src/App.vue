<template>
  <RouterView />
  <div class="toast">
    <Toast
      v-if="toast.show"
      :type="toast.type"
    >
      {{ toast.message }}
    </Toast>
  </div>
</template>

<script lang="ts" setup>
import { RouterView } from "vue-router";
import { provide, ref, watch } from "vue";
import { Toast, ToastType } from "web-components";

import { useApplicationStore } from "@/common/stores/application";
import { APPEARANCE } from "./config/global";

let interval: NodeJS.Timeout;

provide("onShowToast", onShowToast);

const application = useApplicationStore();
const toast = ref({
  show: false,
  type: ToastType.success,
  message: ""
});

function onShowToast({ type, message }: { type: ToastType; message: string }) {
  toast.value = {
    show: true,
    type,
    message
  };
  clearTimeout(interval);
  interval = setTimeout(() => {
    toast.value.show = false;
  }, 4000);
}

watch(
  () => application.theme,
  () => {
    if (application.theme) {
      const themes = Object.keys(APPEARANCE);
      document.body.classList.forEach((item) => {
        if (themes.includes(item)) {
          document.body.classList.remove(item);
        }
      });
      document.documentElement.classList.forEach((item) => {
        if (themes.includes(item)) {
          document.documentElement.classList.remove(item);
        }
      });
      document.body.classList.add(application.theme);
      document.documentElement.classList.add(application.theme);
    }
  }
);
</script>

<style lang="scss" scoped>
div.toast {
  position: fixed;
  bottom: 24px;
  min-width: 220px;
  z-index: 11111;

  left: 50%;
  -webkit-transform: translateX(-50%);
  transform: translateX(-50%);
}
</style>
