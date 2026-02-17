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
import { ref } from "vue";
import { useWalletEvents } from "@/common/composables";

import Sidebar from "@/common/components/Sidebar.vue";
import Header from "@/common/components/Header.vue";
import MobileMenu from "@/common/components/menus/MobileMenu.vue";

useWalletEvents();

const mobileMenu = ref<typeof MobileMenu | null>(null);
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-enter-from,
.fade-leave-active {
  transition: opacity 250ms ease;
  transition:
    opacity 200ms cubic-bezier(0.3, 0, 0.1, 1),
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
