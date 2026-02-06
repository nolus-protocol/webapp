<template>
  <Header :toggle-mobile-nav="() => mobileMenu?.open()" />
  <Sidebar />
  <MobileMenu ref="mobileMenu" />
  <div class="custom-scroll flex justify-center p-4 pt-10 lg:ml-[210px] lg:px-8 lg:pb-16 lg:pt-10">
    <router-view v-slot="{ Component, route }">
      <transition
        appear
        mode="out-in"
        name="fade"
      >
        <div
          :key="route.meta.key! as string"
          class="w-full max-w-[1280px]"
        >
          <component :is="Component"></component>
        </div>
      </transition>
    </router-view>
  </div>
</template>

<script lang="ts" setup>
import { onUnmounted, ref, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { useConnectionStore } from "@/common/stores/connection";
import { useEarnStore } from "@/common/stores/earn";
import { UPDATE_BALANCE_INTERVAL } from "@/config/global";
import { IntercomService, Logger, WalletManager, walletOperation } from "@/common/utils";

import Sidebar from "@/common/components/Sidebar.vue";
import Header from "@/common/components/Header.vue";
import MobileMenu from "@/common/components/menus/MobileMenu.vue";

let balanceInterval: NodeJS.Timeout | undefined;
let sessionTimeOut: NodeJS.Timeout | undefined;

const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const configStore = useConfigStore();
const connectionStore = useConnectionStore();
const earnStore = useEarnStore();

const mobileMenu = ref<typeof MobileMenu | null>(null);

watch(
  () => configStore.initialized,
  async (initialized) => {
    if (!initialized) return;
    await walletOperation(() => {});
    if (wallet.wallet?.address) {
      await connectionStore.connectWallet(wallet.wallet.address);
    }
    window.addEventListener("keplr_keystorechange", updateKeplr);
    window.addEventListener("leap_keystorechange", updateLeap);
    wallet.LOAD_APR();
    startBalancePolling();
  },
  { immediate: true }
);

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(sessionTimeOut);
  window.removeEventListener("keplr_keystorechange", updateKeplr);
  window.removeEventListener("leap_keystorechange", updateLeap);
});

function createKeystoreHandler(connectAction: () => Promise<void>) {
  return async () => {
    try {
      IntercomService.getInstance().disconnect();
      await connectAction();
      if (wallet.wallet?.address) {
        await connectionStore.connectWallet(wallet.wallet.address);
      }
      await loadNetwork();
    } catch (error: Error | any) {
      Logger.error(error);
    }
  };
}

const updateKeplr = createKeystoreHandler(() => wallet.CONNECT_KEPLR());
const updateLeap = createKeystoreHandler(() => wallet.CONNECT_LEAP());

async function loadNetwork() {
  try {
    await Promise.all([wallet.LOAD_APR(), earnStore.fetchPools()]);
  } catch (error: Error | any) {
    Logger.error(error);
  }
}

function startBalancePolling() {
  clearInterval(balanceInterval);
  balanceInterval = setInterval(async () => {
    try {
      if (WalletManager.getWalletAddress() !== "") {
        await balancesStore.fetchBalances();
      }
    } catch (error: Error | any) {
      Logger.error(error);
    }
  }, UPDATE_BALANCE_INTERVAL);
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-enter-from,
.fade-leave-active {
  transition: opacity 250ms ease;
  transition: opacity 200ms cubic-bezier(0.3, 0, 0.1, 1),
              transform 200ms cubic-bezier(0.3, 0, 0.1, 1);
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-from {
  transform: translateY(8px);
}
.fade-leave-to {
  transform: translateY(-8px);
}
</style>
