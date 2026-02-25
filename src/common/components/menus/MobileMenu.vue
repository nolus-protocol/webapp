<template>
  <transition name="fade">
    <div
      v-show="toggleMenuWrapper"
      class="fixed left-0 top-0 z-[99999] h-full w-full bg-neutral-bg-inverted-1/50"
      v-on:click.self="close"
    >
      <div
        class="duration-250 flex h-full max-w-[75%] flex-col bg-neutral-bg-1 transition-transform md:max-w-[400px] landscape:overflow-auto"
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
              <RouterLink
                :to="routePath(item)"
                class="router-link flex h-[50px] items-center gap-2 border-b border-t border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
                @click="close"
              >
                <SvgIcon
                  :name="sidebarIconMap[item] ?? item"
                  size="l"
                />
                {{ $t(`message.${item}`) }}
              </RouterLink>
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-1 pb-12">
          <RouterLink
            @click="close"
            :to="{ name: RouteNames.VOTE }"
            class="router-link flex h-[50px] items-center gap-2 border-b border-t border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
          >
            <div class="flex items-center gap-2">
              <SvgIcon
                name="vote"
                size="l"
              />
              {{ $t("message.vote") }}
            </div>
          </RouterLink>
          <RouterLink
            @click="close"
            :to="{ name: RouteNames.STATS }"
            class="router-link flex h-[50px] items-center gap-2 border-b border-t border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
          >
            <div class="flex items-center gap-2">
              <SvgIcon
                name="bar-chart"
                size="l"
              />
              {{ $t("message.stats") }}
            </div>
          </RouterLink>
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
.router-link-active {
  border-bottom: 1px solid var(--color-border-default);
  border-top: 1px solid var(--color-border-default);
  background-color: var(--color-background-level-2);
  color: var(--color-typography-link);
  box-shadow: 0px 1px 2px 0px var(--color-shadow-default);

  svg {
    fill: var(--color-icon-link);
  }
}

.router-link:not(.router-link-active) {
  &:hover {
    border-bottom: 1px solid var(--color-border-default);
    border-top: 1px solid var(--color-border-default);
    background-color: var(--color-background-level-2);
    color: var(--color-typography-link);
    box-shadow: 0px 1px 2px 0px var(--color-shadow-default);

    svg {
      fill: var(--color-icon-link);
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 250ms;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
</style>
