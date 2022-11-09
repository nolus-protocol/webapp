<template>
  <div v-cloak class="block w-screen md:w-[516px] -mt-8 md:mt-auto">
    <div class="background rounded-2xl md:border nls-border shadow-box md:filter-none outline">
      <h1 class="text-28 md:text-32 nls-font-700 text-primary text-center pt-6 pb-5 relative z-[2]">
        {{ $t("message.connect-wallet") }}
      </h1>

      <div class="separator-line z-[100]"></div>

      <div class="flex px-4 md:px-10 pt-10 relative z-[2] lg:pt-6">
        <button class="btn btn-box btn-large-box basis-0 grow" @click="clickConnectToKeplr">
          <span class="icon icon-keplr ml-1"></span>
          {{ $t("message.keplr") }}
        </button>

        <button class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow" @click="googleAuth()"
          :class="{ disabled: loadingGoogle }">
          <span class="icon icon-google"></span>
          {{ $t("message.google") }}
        </button>
      </div>

      <div class="flex mt-6 md:mt-5 px-4 md:px-10 relative z-[2]">
        <button class="btn btn-box btn-large-box mr-5 md:mr-4 basis-0 grow" @click="clickImportLedger">
          <span class="icon icon-ledger"></span>
          {{ $t("message.ledger") }}
        </button>

        <button class="btn btn-box btn-large-box basis-0 grow" @click="clickImportSeed">
          <span class="icon icon-recover"></span>
          {{ $t("message.recover") }}
        </button>
      </div>

      <div
        class="block separator-line nls-font-400 text-12 text-center mt-10 md:mt-7 mx-4 md:mx-10 md:mb-0 relative z-[2]">
        <span class="background px-3 relative z-[2] text-primary">
          {{ $t("message.continue-with") }}
        </span>
      </div>

      <div class="background h-[420px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

      <div class="align-center justify-center pt-7 text-center mx-auto md:flex">
        <button class="btn btn-primary btn-large-primary w-80 mb-4 md:mb-10" :class="{ 'js-loading': loadingGoogle }"
          @click="clickCreateAccount">
          {{ $t("message.create-new-account") }}
        </button>
        <div class="background h-[60px] relative md:hidden mt-[-62px] mx-[-2px]"></div>
      </div>
    </div>

    <div
      class="md:hidden flex align-center justify-center md:pt-7 pt-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal z-[100]">
      <button class="btn btn-primary btn-large-primary w-80 mb-4 lg:mb-10" :class="{ 'js-loading': loadingGoogle }"
        @click="clickCreateAccount">
        {{ $t("message.create-new-account") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import router from '@/router';
import { RouteNames } from '@/router/RouterNames';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';
import { Web3AuthProvider } from '@/utils';
import { ADAPTER_EVENTS, type CONNECTED_EVENT_DATA } from '@web3auth/base';
import { onMounted, onUnmounted, ref } from 'vue';

const wallet = useWalletStore();
const loadingGoogle = ref(true);

onMounted(() => {
  googleAuth();
});

onUnmounted(async () => {
  await removListeners();
});

const clickConnectToKeplr = () => {
  router.push({ name: RouteNames.CONNECT_KEPLR });
};

const clickImportLedger = () => {
  router.push({ name: RouteNames.IMPORT_LEDGER });
};

const clickImportSeed = () => {
  router.push({ name: RouteNames.IMPORT_SEED });
};

const clickCreateAccount = () => {
  router.push({ name: RouteNames.CREATE_ACCOUNT });
};

const googleAuth = async () => {
  try {
    loadingGoogle.value = true;
    await listen();
    await init();
  } catch (error: Error | any) {
    loadingGoogle.value = false;
  }
}

const listen = async () => {
  const instance = await Web3AuthProvider.getInstance();

  if (instance.web3auth.status != ADAPTER_EVENTS.CONNECTED) {
    await removListeners();
    instance.web3auth.once(ADAPTER_EVENTS.CONNECTED, (data: CONNECTED_EVENT_DATA) => {
      return init();
    });
  }

}

const removListeners = async () => {
  const instance = await Web3AuthProvider.getInstance();
  instance.web3auth.removeAllListeners(ADAPTER_EVENTS.CONNECTED);
}

const init = async () => {
  const res = await wallet[WalletActionTypes.CONNECT_GOOGLE]();
  if (res) {
    loadingGoogle.value = false;
    return await router.push({ name: RouteNames.SET_PASSWORD });
  }
}

</script>
