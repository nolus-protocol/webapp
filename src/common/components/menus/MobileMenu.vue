<template>
  <transition name="fade">
    <div
      v-show="toggleMenuWrapper"
      class="fixed top-0 left-0 z-99999 h-full w-full bg-neutral-bg-inverted-1/50"
      v-on:click.self="close"
    >
      <div
        class="flex h-full max-w-[75%] flex-col bg-neutral-bg-1 transition-transform duration-250 md:max-w-100 landscape:overflow-auto"
        :class="{ 'translate-x-0': toggleMobileNav, '-translate-x-full': !toggleMobileNav }"
      >
        <div class="flex w-full flex-1 flex-col gap-4">
          <div class="flex items-center justify-between px-4 pt-4">
            <span class="text-24 font-semibold text-typography-default">{{ $t(`message.menu`) }}</span>
            <SvgIcon
              name="close"
              class="cursor-pointer"
              @click="close"
            />
          </div>
          <div class="flex flex-col gap-3">
            <template
              v-for="item in mainMenuRoutes"
              :key="item"
            >
              <SidebarLink
                @click="close"
                :to="routePath(item)"
                :icon="sidebarIconMap[item] ?? item"
                :content="$t(`message.${item}`)"
              />
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-1 pb-12">
          <SidebarLink
            @click="close"
            :to="{ name: RouteNames.VOTE }"
            icon="vote"
            :content="$t('message.vote')"
          />
          
          <SidebarLink
            @click="close"
            :to="{ name: RouteNames.STATS }"
            icon="stats"
            :content="$t('message.stats')"
          />
          <p class="text-upper text-center text-12 text-typography-secondary">
            #
            <template v-if="block > 0">{{ block }} v{{ version }}</template>
          </p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { provide, ref } from "vue";
import { RouteNames } from "@/router";
import SidebarLink from "../SidebarLink.vue";
import { SvgIcon } from "web-components";
import { sidebarIconMap, mainMenuRoutes, routePath } from "./menuConfig";
import { useBlockInfo } from "@/common/composables/useBlockInfo";

const toggleMobileNav = ref(false);
const toggleMenuWrapper = ref(false);

const { block, version } = useBlockInfo();

const open = () => {
  document.body.style.overflow = "hidden";
  toggleMenuWrapper.value = true;

  setTimeout(() => {
    toggleMobileNav.value = true;
  }, 100);
};

const close = () => {
  document.body.style.overflow = "auto";
  toggleMobileNav.value = false;

  setTimeout(() => {
    toggleMenuWrapper.value = false;
  }, 250);
};

provide("open", open);
provide("close", close);

defineExpose({ open, close });
</script>

<style scoped lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: opacity 250ms;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
