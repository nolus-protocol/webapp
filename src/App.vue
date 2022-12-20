<template>
  <RouterView />
  <Modal v-if="showErrorDialog" @close-modal="showErrorDialog = false" route="alert">
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";

import Modal from '@/components/modals/templates/Modal.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import { useApplicationStore, ApplicationActionTypes } from '@/stores/application';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';

const showErrorDialog = ref(false);
const errorMessage = ref('');
const application = useApplicationStore();
const wallet = useWalletStore();

onMounted(async () => {
  await loadNetwork();
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
