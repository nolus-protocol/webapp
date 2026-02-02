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
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { useEarnStore } from "@/common/stores/earn";
import { UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from "@/config/global";
import { IntercomService, Logger, WalletManager, walletOperation } from "@/common/utils";

import Sidebar from "@/common/components/Sidebar.vue";
import Header from "@/common/components/Header.vue";
import MobileMenu from "@/common/components/menus/MobileMenu.vue";

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;
let sessionTimeOut: NodeJS.Timeout | undefined;

const wallet = useWalletStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const earnStore = useEarnStore();

const showErrorDialog = ref(false);
const errorMessage = ref("");
const mobileMenu = ref<typeof MobileMenu | null>(null);

watch(
  () => configStore.initialized,
  () => {
    walletOperation(() => {});
    window.addEventListener("keplr_keystorechange", updateKeplr);
    window.addEventListener("leap_keystorechange", updateLeap);
    checkBalances();
  }
);

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  clearInterval(sessionTimeOut);
  window.removeEventListener("keplr_keystorechange", updateKeplr);
  window.addEventListener("leap_keystorechange", updateLeap);
});

async function updateKeplr() {
  try {
    IntercomService.getInstance().disconnect();
    await wallet.CONNECT_KEPLR();
    await loadNetwork();
    await wallet.UPDATE_BALANCES();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function updateLeap() {
  try {
    IntercomService.getInstance().disconnect();
    await wallet.CONNECT_LEAP();
    await loadNetwork();
    await wallet.UPDATE_BALANCES();
  } catch (error: Error | any) {
    Logger.error(error);
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function loadNetwork() {
  try {
    await Promise.all([wallet.LOAD_APR(), earnStore.fetchPools(), checkBalances(), checkPrices()]);
  } catch (error: Error | any) {
    Logger.error(error);
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function checkBalances() {
  balanceInterval = setInterval(async () => {
    try {
      if (WalletManager.getWalletAddress() !== "") {
        await wallet.UPDATE_BALANCES();
      }
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_BALANCE_INTERVAL);
}

async function checkPrices() {
  pricesInterval = setInterval(async () => {
    try {
      await pricesStore.fetchPrices();
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_PRICES_INTERVAL);
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
