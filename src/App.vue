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
  <div
    v-if="wallet.wallet_connect.toast"
    class="wallet-connect fixed left-1/2 top-4 z-[11111] flex w-[90vw] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-xl bg-white px-4 py-3 shadow-gray-800/30"
  >
    <div class="flex items-center gap-3">
      <img
        src="./assets/icons/wallets/walletconnect.svg"
        alt="App"
        class="h-8 w-8 rounded-full"
      />
      <div>
        <p class="text-sm font-medium text-gray-900">Continue to Keplr?</p>
        <p class="text-xs text-gray-500">This site wants to open the Keplr app</p>
      </div>
    </div>

    <a
      class="shadow-md ml-4 cursor-pointer select-none rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
      :href="wallet.wallet_connect.url"
      @click="wallet.wallet_connect.toast = false"
      rel="noopener"
      @click.stop
    >
      Continue
    </a>
  </div>
</template>

<script lang="ts" setup>
import { RouterView } from "vue-router";
import { onMounted, provide, ref, watch } from "vue";
import { Toast, ToastType } from "web-components";

import { useApplicationStore } from "@/common/stores/application";
import { APPEARANCE } from "./config/global";
import { initWorker } from "./push/lib";
import { useWalletStore } from "./common/stores/wallet";
import { getCookie, setCookie } from "./common/utils/cookieUtils";
import { AppUtils, ThemeManager } from "./common/utils";
import { useI18n } from "vue-i18n";

let interval: NodeJS.Timeout;
const wallet = useWalletStore();
const i18n = useI18n();

provide("onShowToast", onShowToast);

onMounted(() => {
  if (!import.meta.env.SSR) {
    initWorker();
    const language = getCookie(AppUtils.LANGUAGE);
    if (!language) {
      const locale = i18n.locale.value;
      setCookie(AppUtils.LANGUAGE, locale);
    }

    const theme_data = getCookie(ThemeManager.THEME_DATA);
    if (!theme_data) {
      setCookie(ThemeManager.THEME_DATA, application.theme);
    }
  }
});

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
div.wallet-connect {
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.24);
}
button {
  z-index: 11111;
  position: absolute;
}
</style>
