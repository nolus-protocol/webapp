<template>
  <div class="flex relative z-[2] flex-col">

    <div class="px-4">
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
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";

import { onMounted, ref } from "vue";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";

const wallet = useWalletStore();
const showError = ref(false);
const errorMessage = ref("");

const props = defineProps({
  back: {
    type: Function,
    required: false
  },
  close: {
    type: Function,
    required: true
  },
});

const connectLeap = async () => {
  try {
    await wallet[WalletActionTypes.CONNECT_LEAP]({ isFromAuth: true });
    props.close();
  } catch (e: Error | any) {
    showError.value = true;
    errorMessage.value = e?.message;
  }
};

const clickTryAgain = async () => {
  showError.value = false;
  errorMessage.value = "";
  await connectLeap();
};

onMounted(async () => {
  await connectLeap();
});

const goToAuth = () => {
  showError.value = false;
  if(props.back){
    props.back();
  }
};
</script>
