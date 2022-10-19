<template>
  <div
    class="block rounded-2xl background md:pb-10 pt-6 pb-[200px] -mt-8 md:mt-auto md:border nls-border shadow-box w-screen md:w-[516px]">
    <h1 class="text-to-big-number text-primary text-center relative z-[2]">
      <button class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10" type="button" @click="clickBack">
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
      </button>
      <span class="inline-block align-baseline text-28 md:text-32">
        {{ $t("message.import-seed") }}
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <div class="px-4 md:px-10 relative z-[2]">
      <TextField 
        id="seed" 
        v-model:value.trim="importStr" 
        :error-msg="seedErrorMessage"
        :is-error="seedErrorMessage.length > 0" 
        :label="$t('message.mnemonic-seed-or-key')" 
        name="seed" 
      />

      <div class="mt-6 hidden md:flex">
        <button class="btn btn-primary btn-large-primary mr-4" @click="clickImport">
          {{ $t("message.import") }}
        </button>
      </div>
    </div>

    <div class="background h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

    <div
      class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal">
      <button class="btn btn-primary btn-large-primary w-80" @click="clickImport">
        {{ $t("message.import") }}
      </button>
    </div>
  </div>

  <Modal v-if="showError" @close-modal="showError = false" route="alert">
    <ErrorDialog 
      :title="$t('message.error-connecting')" 
      :message="modalErrorMessage" 
      :try-button="clickTryAgain" 
    />
  </Modal>
</template>

<script setup lang="ts">
import TextField from '@/components/TextField.vue';
import router from '@/router';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import Modal from '@/components/modals/templates/Modal.vue';

import { ref } from 'vue';
import { ArrowLeftIcon } from '@heroicons/vue/24/solid';
import { useI18n } from 'vue-i18n';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';
import { RouteNames } from '@/router/RouterNames';

const showError = ref(false);
const modalErrorMessage = ref('');
const importStr = ref('');
const seedErrorMessage = ref('');
const i18n = useI18n();
const wallet = useWalletStore();

const clickTryAgain = async () => {
  showError.value = false;
  modalErrorMessage.value = '';
  importStr.value = '';
};

const clickBack = () => {
  router.replace({ name: RouteNames.AUTH });
};

const clickImport = async () => {
  if (importStr.value.length == 0) {
    seedErrorMessage.value = i18n.t('message.text-field-error');
    return;
  }

  try {
    await wallet[WalletActionTypes.CONNECT_VIA_MNEMONIC](importStr.value);
    importStr.value = '';
    seedErrorMessage.value = '';
    await router.push({ name: RouteNames.SET_PASSWORD });
  } catch (e: Error | any) {
    showError.value = true;
    modalErrorMessage.value = e?.message;
  }
};

</script>
