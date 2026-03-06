<template>
  <RouterView />
  <div class="toast">
    <Toast
      v-if="toast.show"
      :key="toast.key"
      :type="toast.type"
      :timeout="4000"
      :on-close="() => (toast.show = false)"
    >
      {{ toast.message }}
    </Toast>
  </div>
</template>

<script lang="ts" setup>
import { RouterView } from "vue-router";
import { onMounted, provide, ref } from "vue";
import { Toast, ToastType } from "web-components";

import { initWorker } from "./push/lib";
import { getCookie, setCookie } from "./common/utils/cookieUtils";
import { LANGUAGE_KEY } from "./common/utils";
import { getTheme } from "./common/utils/ThemeManager";
import { useI18n } from "vue-i18n";
import { BackendApi } from "./common/api/BackendApi";

const i18n = useI18n();

provide("onShowToast", onShowToast);

BackendApi.onRateLimited = () => {
  onShowToast({
    type: ToastType.error,
    message: i18n.t("message.rate-limit-exceeded")
  });
};

onMounted(() => {
  initWorker();
  const language = getCookie(LANGUAGE_KEY);
  if (!language) {
    const locale = i18n.locale.value;
    setCookie(LANGUAGE_KEY, locale);
  }

  const theme_data = getCookie("theme_data");
  if (!theme_data) {
    setCookie("theme_data", getTheme());
  }
});

const toast = ref({
  show: false,
  type: ToastType.success,
  message: "",
  key: 0
});

function onShowToast({ type, message }: { type: ToastType; message: string }) {
  toast.value = {
    show: true,
    type,
    message,
    key: toast.value.key + 1
  };
}
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
button {
  z-index: 11111;
  position: absolute;
}
</style>
