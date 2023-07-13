<template>
  <LogoLink link="/"></LogoLink>
  <div id="notifications-nls">
    <div class="nls-md-show">
      <LogoLink link="/"></LogoLink>
    </div>
    <!--TODO: FOR FUTURE DEV -->
    <!-- <div ref="notifications">
      <button
        :class="showNotifications ? 'active' : false"
        class="show-box-pop btn-header mr-2 c-navbar-qr__button"
        @click="showNotifications = !showNotifications"
      >
        <span
          class="icon-bell mr-0"
          style="font-size: 1.5em; margin-right: 0"
        ></span>
        <span class="counter">8</span>
      </button>

      <Notifications v-show="showNotifications" />
    </div> -->
  </div>
  <div
    id="wallet-nls"
    ref="wallet"
  >
    <button
      v-if="walletStore.wallet"
      class="show-box-wallet btn-header with-icon shadow-box rounded-r-none"
      :class="showWallet ? 'active' : false"
      @click="showWallet = !showWallet"
    >
      <span
        class="icon-wallet mr-0"
        style="font-size: 1.5em !important; margin-right: 0"
      >
      </span>
      <span class="text-12 nls-font-400 text-primary nls-md-hidden">
        {{ walletStore.walletName }}
      </span>
    </button>

    <button
      v-else
      class="show-box-wallet btn-header with-icon shadow-box rounded-r-none"
      @click="showAuthDialog = !showAuthDialog"
    >
      <span
        class="icon-wallet mr-0"
        style="font-size: 1.5em !important; margin-right: 0"
      >
      </span>
      <span class="text-12 nls-font-400 text-primary nls-md-hidden">
        {{ $t('message.connect-wallet') }}
      </span>
    </button>

    <!-- <Notifications /> -->
    <Transition
      name="collapse"
      appear
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
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useWalletStore } from "@/stores/wallet";

import WalletOpen from "@/components/WalletOpen.vue";
import LogoLink from "@/components/LogoLink.vue";
import Modal from "./modals/templates/Modal.vue";
import AuthDialog from "./modals/AuthDialog.vue";

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
    const isClickedOutside = notifications.value?.contains(
      event.target as Node
    );
    if (!isClickedOutside) {
      showNotifications.value = false;
    }
  }
};
</script>
