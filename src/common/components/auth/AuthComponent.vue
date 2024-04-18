<template>
  <div class="relative z-[2] flex pb-2">
    <button
      class="btn btn-box btn-large-box auth grow basis-0"
      @click="clickConnectToKeplr"
    >
      <span class="icon icon-keplr ml-1"></span>
      {{ $t("message.keplr") }}
    </button>

    <button
      class="btn btn-box btn-large-box auth ml-5 grow basis-0 md:ml-4"
      @click="clickConnectToLeap"
    >
      <span class="icon icon-leap ml-1"></span>
      {{ $t("message.leap") }}
    </button>
  </div>

  <div class="relative z-[2] flex pb-6 pt-3 lg:pt-2">
    <button
      class="btn btn-box btn-large-box auth grow basis-0"
      @click="clickImportLedger"
    >
      <span class="icon icon-ledger mb-[4px]"></span>
      {{ $t("message.ledger") }}
    </button>

    <div class="fake-button ml-5 grow basis-0 md:ml-4"></div>
  </div>

  <div class="text-dark-grey relative z-[2] pb-2 text-[13px]">
    By connecting a wallet, you acknowledge that you have read, agree and accept Nolus Protocol’s
    <button
      class="text-[#2868E1]"
      @click="onShowTermsModal"
    >
      Terms of Service
    </button>
  </div>
  <Modal
    v-if="showTermsModal"
    route="terms-of-service"
    @close-modal="showTermsModal = false"
  >
    <TermsDialog></TermsDialog>
  </Modal>
</template>

<script lang="ts" setup>
import Modal from "@/common/components/modals/templates/Modal.vue";
import TermsDialog from "@/common/components/modals/TermsDialog.vue";
import { WalletActions } from "@/common/stores/wallet";
import { ref } from "vue";

const showTermsModal = ref(false);
const props = defineProps({
  switchView: {
    type: Function,
    required: true
  }
});

function clickConnectToKeplr() {
  props.switchView(WalletActions.CONNECT_KEPLR);
}

function clickConnectToLeap() {
  props.switchView(WalletActions.CONNECT_LEAP);
}

function clickImportLedger() {
  props.switchView(WalletActions.CONNECT_LEDGER);
}

function onShowTermsModal() {
  showTermsModal.value = true;
}
</script>
<style lang="scss" scoped>
.fake-button {
  font-size: 14px;
  padding: 19px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
