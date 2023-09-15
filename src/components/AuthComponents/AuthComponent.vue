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
      @click="clickImportMetamask"
    >
      <span class="icon mb-[4px] w-[36px] h-[36px]">
        <img
          width="36"
          height="36"
          src="@/assets/icons/metamask.svg"
        />
      </span>
      {{ $t("message.metamask") }}
    </button>

  </div>

  <div class="flex pt-3 pb-6 relative z-[2] lg:pt-2">
    <button
      class="btn btn-box btn-large-box basis-0 grow auth"
      @click="clickImportLedger"
    >
      <span class="icon icon-ledger mb-[4px]"></span>
      {{ $t("message.ledger") }}
    </button>

    <button
      class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow auth"
      @click="clickConnectToLeap"
    >
      <span class="icon icon-leap ml-1"></span>
      {{ $t("message.leap") }}
    </button>

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
import { WalletActionTypes } from "@/stores/wallet";
import { ref } from "vue";

const showTermsModal = ref(false);
const props = defineProps({
  switchView: {
    type: Function,
    required: true
  }
})

const clickConnectToKeplr = () => {
  props.switchView(WalletActionTypes.CONNECT_KEPLR);
};

const clickConnectToLeap = () => {
  props.switchView(WalletActionTypes.CONNECT_LEAP);
}

const clickImportLedger = () => {
  props.switchView(WalletActionTypes.CONNECT_LEDGER);
};

const clickImportMetamask = () => {
  props.switchView(WalletActionTypes.CONNECT_METAMASK);
};

const onShowTermsModal = () => {
  showTermsModal.value = true;
}

</script>
<style scoped lang="scss">
.fake-button {
  font-size: 14px;
  padding: 19px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}</style>