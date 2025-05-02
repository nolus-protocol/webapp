<template>
  <button
    @click="onclick"
    id="open-keplr"
  >
    Connect with Keplr
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
import { onMounted, provide, ref, watch } from "vue";
import { Toast, ToastType } from "web-components";

import { useApplicationStore } from "@/common/stores/application";
import { APPEARANCE } from "./config/global";
import { SignClient } from "@walletconnect/sign-client";

let interval: NodeJS.Timeout;
const url = ref("");

provide("onShowToast", onShowToast);

async function onclick() {
  const signClient = await SignClient.init({
    projectId: "3effa9b81e6b6bea7da5022096ea8c68",
    metadata: {
      name: "Nolus",
      description:
        "Nolus Protocol is a Web3 financial suite that offers an innovative approach to money markets with a novel lease solution to further develop the DeFi space",
      url: "http://localhost:8080",
      icons: [
        "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/networks/nolus.svg"
      ]
    }
  });

  console.log(signClient.session.getAll());

  const { uri, approval } = await signClient.connect({
    requiredNamespaces: {
      cosmos: {
        methods: [
          "cosmos_getAccounts",
          "cosmos_signDirect",
          "cosmos_signAmino",
          "keplr_getKey",
          "keplr_signAmino",
          "keplr_signDirect",
          "keplr_signArbitrary",
          "keplr_enable",
          "keplr_signEthereum",
          "keplr_experimentalSuggestChain",
          "keplr_suggestToken"
        ],
        chains: ["cosmos:osmosis-1", "cosmos:pirin-1", "cosmos:cosmoshub-4"], // or your target chain
        events: ["accountsChanged", "chainChanged", "keplr_accountsChanged"]
      }
    }
  });
  const encoded = encodeURIComponent(uri as string);
  const universalURL = `intent://wcV2?${encoded}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`;
  console.log(uri);
  console.log(encoded);

  // window.location.href = universalURL;
  window.open(universalURL, "_blank", "noopener");

  const session = await approval();

  const result = await signClient.request({
    topic: session.topic,
    chainId: "cosmos:pirin-1",
    request: {
      method: "cosmos_getAccounts",
      params: {}
    }
  });

  console.log("Accounts:", result);
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
