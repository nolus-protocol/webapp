<template>
  <div class="relative z-[2] flex flex-col">
    <div class="px-4">
      <p class="nls-font-400 relative z-[2] text-14 text-primary">
        {{ $t("message.approving-extension") }}
      </p>
      <div class="mt-6 hidden md:flex">
        <button class="btn btn-primary btn-large-primary js-loading -px-20 mr-4">
          {{ $t("message.connecting") }}
        </button>
        <div class="background relative mx-[-2px] mt-[-50px] h-[60px] md:hidden"></div>
      </div>
    </div>
    <div
      class="align-center background inset-x-0 bottom-0 mx-auto flex justify-center px-4 pt-8 text-center md:relative md:hidden"
    >
      <button class="btn btn-primary btn-large-primary js-loading w-full">
        {{ $t("message.connecting") }}
      </button>
    </div>
  </div>

  <Modal
    v-if="showError"
    route="alert"
    @close-modal="
      showError = false;
      goToAuth();
    "
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="clickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { onMounted, ref } from "vue";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";

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
  }
});

onMounted(async () => {
  await connectLeap();
});

async function connectLeap() {
  try {
    await wallet[WalletActions.CONNECT_LEAP]();
    props.close();
  } catch (e: Error | any) {
    showError.value = true;
    errorMessage.value = e?.message;
  }
}

async function clickTryAgain() {
  showError.value = false;
  errorMessage.value = "";
  await connectLeap();
}

function goToAuth() {
  showError.value = false;
  if (props.back) {
    props.back();
  }
}
</script>
