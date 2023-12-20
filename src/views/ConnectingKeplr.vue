<template>
  <div
    class="block md:rounded-2xl rounded-t-2xl background md:mt-auto pb-[300px] md:pb-10 pt-6 md:border nls-border shadow-box lg:w-[516px] outline h-full md:h-auto"
  >
    <h1 class="text-to-big-number text-primary text-center relative">
      <button
        class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10"
        type="button"
        @click="clickBack"
      >
        <ArrowLeftIcon
          aria-hidden="true"
          class="h-6 w-6"
        />
      </button>
      <span class="inline-block align-baseline text-28 md:text-32 relative z-[2]">
        {{ $t("message.connecting-kepler") }}
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <div class="px-4 md:px-10">
      <p class="text-14 nls-font-400 text-primary relative z-[2]">
        {{ $t("message.approving-extension") }}
      </p>
      <div class="mt-6 md:flex hidden">
        <button class="btn btn-primary btn-large-primary mr-4 js-loading -px-20">
          {{ $t("message.connecting") }}
        </button>
        <div class="background h-[60px] relative md:hidden mt-[-50px] mx-[-2px]"></div>
      </div>
    </div>
    <div
      class="md:hidden flex align-center justify-center px-4 pt-8 text-center mx-auto background inset-x-0 bottom-0 md:relative"
    >
      <button class="btn btn-primary btn-large-primary js-loading w-full">
        {{ $t("message.connecting") }}
      </button>
    </div>
  </div>

  <Modal
    v-if="showError"
    @close-modal="
      showError = false;
    goToAuth();
    "
    route="alert"
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="clickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import router from "@/router";
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";

import { onMounted, ref } from "vue";
import { ArrowLeftIcon } from "@heroicons/vue/24/solid";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";
import { RouteNames } from "@/router/RouterNames";

const wallet = useWalletStore();
const showError = ref(false);
const errorMessage = ref("");

onMounted(async () => {
  await connectKeplr();
});

function clickBack() {
  router.replace({ name: RouteNames.AUTH });
};

async function connectKeplr() {
  try {
    await wallet[WalletActionTypes.CONNECT_KEPLR]({ isFromAuth: true });
  } catch (e: Error | any) {
    console.log(e)
    showError.value = true;
    errorMessage.value = e?.message;
  }
};

async function clickTryAgain() {
  showError.value = false;
  errorMessage.value = "";
  await connectKeplr();
};

function goToAuth() {
  router.replace({ name: RouteNames.AUTH });
};
</script>
