<template>
  <form
    class="flex relative z-[2] flex-col"
    @submit.prevent="connectViaLedger"
  >

    <div class="px-4">
      <p
        class="text-14 nls-font-400 text-primary relative z-[2]"
        v-html="$t('message.ledger-dongle')"
      ></p>

      <div class="relative block checkbox-container z-[2]">
        <div class="flex items-center w-full pt-6">
          <input
            id="use-bluethooth"
            name="use-bluethooth"
            type="checkbox"
            v-model="isBluetoothConnection"
          />
          <label
            class="text-primary"
            for="use-bluethooth"
          >{{ $t("message.use-bluethooth") }}</label>
        </div>
      </div>

      <div class="mt-6 md:flex hidden">
        <button
          class="btn btn-primary btn-large-primary"
          :class="{ 'js-loading': disabled }"
        >
          {{ $t("message.connect") }}
        </button>
      </div>
    </div>

    <div
      class="md:hidden flex align-center justify-center px-4 pt-8 text-center mx-auto background inset-x-0 bottom-0 md:relative w-full"
    >
      <button
        class="btn btn-primary btn-large-primary w-full"
        :class="{ 'js-loading': disabled }"
      >
        {{ $t("message.connect") }}
      </button>
    </div>
  </form>

  <Modal
    v-if="showError"
    route="alert"
    @close-modal="
      showError = false;
    goToAuth();
    "
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="clickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";

import { ref } from "vue";
import { WalletActionTypes, useWalletStore } from "@/stores/wallet";
import { useI18n } from "vue-i18n";

const showError = ref(false);
const isBluetoothConnection = ref(false);
const errorMessage = ref("");
const wallet = useWalletStore();
const i18n = useI18n();
const disabled = ref(false);

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

const connectViaLedger = async () => {
  try {
    if ((navigator as any)?.usb == null) {
      showError.value = true;
      errorMessage.value = i18n.t("message.ledger-support-error");
      return false;
    }
    disabled.value = true;
    await wallet[WalletActionTypes.CONNECT_LEDGER]({
      isFromAuth: true,
      isBluetooth: isBluetoothConnection.value,
    });
    props.close();
  } catch (e: Error | any) {
    showError.value = true;
    errorMessage.value = e?.message;
  } finally {
    disabled.value = false;
  }
};

const clickTryAgain = async () => {
  showError.value = false;
  errorMessage.value = "";
  await connectViaLedger();
};

const goToAuth = () => {
  showError.value = false;
  if (props.back) {
    props.back();
  }
};
</script>
