<template>
  <div id="notifications-nls">
    <div class="nls-md-show">
      <LogoLink link="/"></LogoLink>
    </div>

    <div ref="notifications">
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
    </div>
  </div>
  <div id="wallet-nls" ref="wallet">
    <button
      :class="showWallet ? 'active' : false"
      class="show-box-wallet btn-header with-icon shadow-box rounded-r-none"
      @click="showWallet = !showWallet"
    >
      <span
        class="icon-wallet mr-0"
        style="font-size: 1.5em !important; margin-right: 0"
      ></span>

      <span class="text-12 nls-font-400 text-primary nls-md-hidden">{{ walletStore.walletName }}</span
      >
    </button>

    <!-- <Notifications /> -->
    <WalletOpen v-show="showWallet" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import Notifications from '@/components/Notifications.vue';
import WalletOpen from '@/components/WalletOpen.vue';
import LogoLink from '@/components/LogoLink.vue';
import { useWalletStore } from '@/stores/wallet';

const showWallet = ref(false);
const showNotifications = ref(false);
const notifications = ref(null as HTMLDivElement | null);
const wallet = ref(null as HTMLDivElement | null);
const walletStore = useWalletStore();

onMounted(() => {
  document.addEventListener('click', onClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onClick);
});

const onClick = (event: MouseEvent) => {
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
<style scoped>
@media (max-width: 768px) {
  .active {
    /* background-neutral-medium */
    background-color: red;
    /* background: #ebeff5;*/
  }
}
</style>
