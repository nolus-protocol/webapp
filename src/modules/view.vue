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
import { onMounted, onUnmounted, ref } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from "@/config/global";
import { Logger, WalletManager, walletOperation } from "@/common/utils";

import Sidebar from "@/common/components/Sidebar.vue";
import Header from "@/common/components/Header.vue";
import MobileMenu from "@/common/components/menus/MobileMenu.vue";

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;
let sessionTimeOut: NodeJS.Timeout | undefined;

const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

const showErrorDialog = ref(false);
const errorMessage = ref("");
const mobileMenu = ref<typeof MobileMenu | null>(null);

onMounted(async () => {
  walletOperation(() => {});
  window.addEventListener("keplr_keystorechange", updateKeplr);
  window.addEventListener("leap_keystorechange", updateLeap);
  checkBalances();
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  clearInterval(sessionTimeOut);
  window.removeEventListener("keplr_keystorechange", updateKeplr);
  window.addEventListener("leap_keystorechange", updateLeap);
});

async function updateKeplr() {
  try {
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
    await Promise.all([wallet.LOAD_APR(), app.LOAD_APR_REWARDS(), checkBalances(), checkPrices()]);
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
      await oracle.GET_PRICES();
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_PRICES_INTERVAL);
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 350ms ease;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
