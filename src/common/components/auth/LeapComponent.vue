<template>
  <p class="text-14 font-normal text-neutral-typography-200 md:text-left">
    {{ $t("message.approving-extension") }}
  </p>
  <Button
    :label="$t('message.connecting')"
    class="mt-6 w-full md:w-auto"
    loading
    severity="secondary"
    size="large"
  />

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
import { Button } from "web-components";

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
