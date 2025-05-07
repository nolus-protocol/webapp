<template>
  <button
    class="primary-button"
    @click="test"
  >
    TEST WC
  </button>
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
import { useWalletStore, WalletActions } from "./common/stores/wallet";
import SignClient from "@walletconnect/sign-client";

let interval: NodeJS.Timeout;
const wallet = useWalletStore();

provide("onShowToast", onShowToast);

async function test() {
  // const signClient = await SignClient.init({
  //   projectId: "3effa9b81e6b6bea7da5022096ea8c68",
  //   metadata: {
  //     name: "Nolus",
  //     description: "A short description for your wallet",
  //     url: "",
  //     icons: ["<URL TO WALLET'S LOGO/ICON>"]
  //   }
  // });

  // const { uri, approval } = await signClient.connect({
  //   requiredNamespaces: {
  //     cosmos: {
  //       methods: ["cosmos_getAccounts", "cosmos_signDirect", "cosmos_signAmino"],
  //       chains: ["cosmos:osmosis-1"], // or your target chain
  //       events: []
  //     }
  //   }
  // });

  // console.log(uri);

  // const session = await approval();
  // console.log("Connected session:", session);

  // const result = await signClient.request({
  //   topic: session.topic,
  //   chainId: "cosmos:osmosis-1",
  //   request: {
  //     method: "cosmos_getAccounts",
  //     params: {}
  //   }
  // });
  // console.log(result);
  wallet[WalletActions.CONNECT_WC]();
}

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
