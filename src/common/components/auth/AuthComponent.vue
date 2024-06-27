<template>
  <div class="mb-8 grid grid-cols-2 gap-4">
    <Boxes
      v-for="connection in connections"
      :key="connection.label"
      :icon="connection.icon"
      :label="connection.label"
      @click="connection.onClick"
    />
  </div>

  <div class="text-[13px] text-neutral-400">
    {{ $t("message.policy") }}
    <button
      class="text-primary-50"
      @click="onShowTermsModal"
    >
      {{ $t("message.terms-of-service") }}
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
import { useI18n } from "vue-i18n";
import { Boxes } from "web-components";

const i18n = useI18n();

const showTermsModal = ref(false);
const props = defineProps({
  switchView: {
    type: Function,
    required: true
  }
});

const connections = {
  Keplr: {
    icon: "icon-keplr",
    label: i18n.t("message.keplr"),
    onClick: clickConnectToKeplr
  },
  Leap: {
    icon: "icon-leap",
    label: i18n.t("message.leap"),
    onClick: clickConnectToLeap
  },
  Ledger: {
    icon: "icon-ledger",
    label: i18n.t("message.ledger"),
    onClick: clickImportLedger
  }
};

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
