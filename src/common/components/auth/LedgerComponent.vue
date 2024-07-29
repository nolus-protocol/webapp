<template>
  <form
    class="flex flex-col"
    @submit.prevent="connectViaLedger"
  >
    <div class="">
      <p
        class="text-14 font-normal text-neutral-typography-200 md:text-left"
        v-html="$t('message.ledger-dongle')"
      />

      <div class="checkbox-container flex w-full items-center pt-6">
        <input
          id="use-bluethooth"
          v-model="isBluetoothConnection"
          name="use-bluethooth"
          type="checkbox"
        />
        <label
          class="text-neutral-typography-200"
          for="use-bluethooth"
          >{{ $t("message.use-bluethooth") }}</label
        >
      </div>

      <Button
        :label="$t('message.connect')"
        :loading="disabled"
        class="mt-6 w-full md:w-auto"
        severity="primary"
        size="large"
        type="submit"
      />
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
import { Button } from "web-components";

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
