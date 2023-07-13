<template>
  <div class="flex pb-2 relative z-[2]">
    <button
      class="btn btn-box btn-large-box basis-0 grow auth"
      @click="clickConnectToKeplr"
    >
      <span class="icon icon-keplr ml-1"></span>
      {{ $t("message.keplr") }}
    </button>

    <button
      class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow auth"
      @click="clickImportLedger"
    >
      <span class="icon icon-ledger mb-[4px]"></span>
      {{ $t("message.ledger") }}
    </button>
  </div>

  <div class="flex pt-10 pb-6 relative z-[2] lg:pt-2">
    <button
      class="btn btn-box btn-large-box basis-0 grow auth"
      @click="clickConnectToLeap"
    >
      <span class="icon icon-leap ml-1"></span>
      {{ $t("message.leap") }}
    </button>
    <div class="btn-large-box ml-5 md:ml-4 basis-0 grow fake-button"></div>
  </div>

  <div class="pb-2 relative z-[2] text-dark-grey text-[13px]">
    By connecting a wallet, you acknowledge that you have read, agree and accept Nolus Protocol’s
    <button
      class="text-[#2868E1]"
      @click="onShowTermsModal"
    >Terms of Service</button>
  </div>
  <Modal
    v-if="showTermsModal"
    @close-modal="showTermsModal = false"
    route="terms-of-service"
  >
    <TermsDialog></TermsDialog>
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/components/modals/templates/Modal.vue";
import TermsDialog from "@/components/modals/TermsDialog.vue";
import router from "@/router";
import { RouteNames } from "@/router/RouterNames";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { ApptUtils } from "@/utils/AppUtils";
import { ref } from "vue";

const wallet = useWalletStore();
const loadingGoogle = ref(false);
const showTermsModal = ref(false);

const clickConnectToKeplr = () => {
  router.push({ name: RouteNames.CONNECT_KEPLR });
};

const clickConnectToLeap = () => {
  router.push({ name: RouteNames.CONNECT_LEAP });
}

const clickImportLedger = () => {
  router.push({ name: RouteNames.IMPORT_LEDGER });
};

const onShowTermsModal = () => {
  showTermsModal.value = true;
}

const clickImportSeed = () => {
  router.push({ name: RouteNames.IMPORT_SEED });
};

const clickCreateAccount = () => {
  router.push({ name: RouteNames.CREATE_ACCOUNT });
};

const googleAuth = async () => {
  try {
    loadingGoogle.value = true;
    const res = await wallet[WalletActionTypes.CONNECT_GOOGLE]();
    if (res) {
      await router.push({ name: RouteNames.SET_PASSWORD });
    }
  } catch (error: Error | any) {
    loadingGoogle.value = false;
  }
};
</script>
<style scoped lang="scss">
.fake-button {
  border-width: 0;

  &:active,
  &:focus,
  &:hover {
    background-color: transparent !important;
    box-shadow: none !important;
  }
}
</style>