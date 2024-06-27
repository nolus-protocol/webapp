<template>
  <div class="sidebar-header">
    <Logo class="block lg:hidden" />
    <div
      id="wallet-nls"
      ref="wallet"
      class="float-right"
    >
      <button
        v-if="walletStore.wallet"
        :class="showWallet ? 'active' : false"
        class="show-box-wallet btn-header with-icon rounded-r-none"
        @click="showWallet = !showWallet"
      >
        <span
          class="icon-wallet mr-0"
          style="font-size: 1.5em !important; margin-right: 0"
        >
        </span>
        <span class="nls-md-hidden text-12 font-normal text-primary">
          {{ walletStore.walletName }}
        </span>
      </button>

      <button
        v-else
        class="show-box-wallet btn-header with-icon rounded-r-none"
        @click="showAuthDialog = !showAuthDialog"
      >
        <span
          class="icon-wallet mr-0"
          style="font-size: 1.5em !important; margin-right: 0"
        >
        </span>
        <span class="nls-md-hidden text-12 font-normal text-primary">
          {{ $t("message.connect-wallet") }}
        </span>
      </button>

      <Transition
        appear
        name="collapse"
      >
        <WalletOpen v-show="showWallet" />
      </Transition>
    </div>

    <Modal
      v-if="showAuthDialog"
      route="authenticate"
      @close-modal="showAuthDialog = false"
    >
      <AuthDialog />
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, provide, ref } from "vue";
import { useWalletStore } from "@/common/stores/wallet";

import WalletOpen from "@/common/components/WalletOpen.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";
import AuthDialog from "@/common/components/modals/AuthDialog.vue";
import Logo from "@/common/components/Logo.vue";

const showWallet = ref(false);
const showNotifications = ref(false);
const notifications = ref(null as HTMLDivElement | null);
const wallet = ref(null as HTMLDivElement | null);
const walletStore = useWalletStore();
const showAuthDialog = ref(false);

onMounted(() => {
  document.addEventListener("click", onClick);
});

onUnmounted(() => {
  document.removeEventListener("click", onClick);
});

function onClick(event: MouseEvent) {
  if (wallet.value) {
    const isClickedOutside = wallet.value?.contains(event.target as Node);
    if (!isClickedOutside) {
      showWallet.value = false;
    }
  }
  if (notifications.value) {
    const isClickedOutside = notifications.value?.contains(event.target as Node);
    if (!isClickedOutside) {
      showNotifications.value = false;
    }
  }
}

provide("toggle", () => {
  showWallet.value = !showWallet.value;
});
</script>
