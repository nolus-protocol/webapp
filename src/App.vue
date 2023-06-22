<template>
  <RouterView />
  <Modal
    v-if="showErrorDialog"
    @close-modal="showErrorDialog = false"
    route="alert"
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";

import { onMounted, onBeforeMount, ref, watch } from "vue";
import { RouterView } from "vue-router";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { storeToRefs } from "pinia";
import { APPEARANCE } from "./config/env";
import { useApplicationStore, ApplicationActionTypes } from "@/stores/application";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const application = useApplicationStore();
const wallet = useWalletStore();
const applicationRef = storeToRefs(application);

onBeforeMount(() => {
  application[ApplicationActionTypes.LOAD_THEME]();
});

onMounted(async () => {
  await loadNetwork();
});

watch(applicationRef.theme, () => {
  if (application.theme) {
    const themes = Object.keys(APPEARANCE);
    document.body.classList.forEach((item) => {
      if (themes.includes(item)) {
        document.body.classList.remove(item);
      }
    });
    document.body.classList.add(application.theme);
  }
});

const onClickTryAgain = async () => {
  await loadNetwork();
};

const loadNetwork = async () => {
  try {
    application[ApplicationActionTypes.CHANGE_NETWORK](false);
    wallet[WalletActionTypes.LOAD_WALLET_NAME]();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
};
</script>
