<template>
  <div
    class="block rounded-2xl bg-white -mt-8 md:mt-auto pb-[300px] md:pb-10 pt-6 md:border border-standart shadow-box lg:w-[516px]"
  >
    <h1 class="text-to-big-number text-primary text-center relative">
      <button
        class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10 z-[2]"
        type="button"
        @click="clickBack"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
      </button>
      <span
        class="inline-block align-baseline text-28 md:text-32 relative z-[2]"
      >
        {{ $t('message.connect-ledger') }}
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <div class="px-4 md:px-10">
      <p 
        class="text-14 nls-font-400 text-primary relative z-[2]"
        v-html="$t('message.ledger-dongle')">
      </p>

      <div class="relative block checkbox-container z-[2]">
        <div class="flex items-center w-full pt-6">
          <input
            id="use-bluethooth"
            name="use-bluethooth"
            type="checkbox"
            v-model="isBluetoothConnection"
          />
          <label for="use-bluethooth">{{ $t('message.use-bluethooth') }}</label>
        </div>
      </div>

      <div class="mt-6 hidden md:flex">
        <button
          class="btn btn-primary btn-large-primary"
          @click="connectViaLedger"
        >
          {{ $t('message.connect') }}
        </button>
      </div>
    </div>
  </div>

  <div
    class="bg-white h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"
  ></div>

  <div
    class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal"
  >
    <button
      class="btn btn-primary btn-large-primary w-80"
      @click="connectViaLedger"
    >
      {{ $t('message.connect') }}
    </button>
  </div>
  <Modal v-if="showError" @close-modal="showError = false">
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="clickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import router from '@/router';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import Modal from '@/components/modals/templates/Modal.vue';

import { ref } from 'vue';
import { ArrowLeftIcon } from '@heroicons/vue/24/solid';
import { WalletActionTypes, useWalletStore } from '@/stores/wallet';
import { RouteNames } from '@/router/RouterNames';

const showError = ref(false);
const isBluetoothConnection = ref(false);
const errorMessage = ref('');
const wallet = useWalletStore();

const clickBack = () => {
  router.replace({ name: RouteNames.AUTH });
};

const connectViaLedger = async () => {
  try {
    await wallet[WalletActionTypes.CONNECT_LEDGER]({
      isFromAuth: true,
      isBluetooth: isBluetoothConnection.value,
    });
  } catch (e: Error | any) {
    showError.value = true;
    errorMessage.value = e?.message;
  }
};

const clickTryAgain = async () => {
  showError.value = false;
  errorMessage.value = '';
  await connectViaLedger();
};

</script>
