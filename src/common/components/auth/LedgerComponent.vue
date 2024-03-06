<template>
  <form
    class="relative z-[2] flex flex-col"
    @submit.prevent="connectViaLedger"
  >
    <div class="px-4">
      <p
        class="nls-font-400 relative z-[2] text-14 text-primary"
        v-html="$t('message.ledger-dongle')"
      ></p>

      <div class="checkbox-container relative z-[2] block">
        <div class="flex w-full items-center pt-6">
          <input
            id="use-bluethooth"
            v-model="isBluetoothConnection"
            name="use-bluethooth"
            type="checkbox"
          />
          <label
            class="text-primary"
            for="use-bluethooth"
            >{{ $t("message.use-bluethooth") }}</label
          >
        </div>
      </div>

      <div class="mt-6 hidden md:flex">
        <button
          :class="{ 'js-loading': disabled }"
          class="btn btn-primary btn-large-primary"
        >
          {{ $t("message.connect") }}
        </button>
      </div>
    </div>

    <div
      class="align-center background inset-x-0 bottom-0 mx-auto flex w-full justify-center px-4 pt-8 text-center md:relative md:hidden"
    >
      <button
        :class="{ 'js-loading': disabled }"
        class="btn btn-primary btn-large-primary w-full"
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
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="clickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";

import { ref } from "vue";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
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
  }
});

async function connectViaLedger() {
  try {
    if ((navigator as any)?.usb == null) {
      showError.value = true;
      errorMessage.value = i18n.t("message.ledger-support-error");
      return false;
    }
    disabled.value = true;
    await wallet[WalletActions.CONNECT_LEDGER]({
      isBluetooth: isBluetoothConnection.value
    });
    props.close();
  } catch (e: Error | any) {
    showError.value = true;
    errorMessage.value = e?.message;
  } finally {
    disabled.value = false;
  }
}

async function clickTryAgain() {
  showError.value = false;
  errorMessage.value = "";
  await connectViaLedger();
}

function goToAuth() {
  showError.value = false;
  if (props.back) {
    props.back();
  }
}
</script>
