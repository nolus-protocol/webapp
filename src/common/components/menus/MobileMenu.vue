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
              v-for="item in filteredRouteNames"
              :key="item"
            >
              <RouterLink
                :to="item === RouteNames.DASHBOARD ? '/' : item"
                class="router-link flex h-[50px] items-center gap-2 border-b border-t border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
                v-on:click="
                  () => {
                    close();
                  }
                "
              >
                <SvgIcon
                  :name="item"
                  size="l"
                />
                {{ $t(`message.${item}`) }}
              </RouterLink>
            </template>
          </div>
        </div>
        <div class="flex flex-col gap-1 pb-12">
          <RouterLink
            :to="{ name: RouteNames.STATS }"
            class="router-link flex h-[50px] items-center gap-2 border-b border-t border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
          >
            <div
              @click="close"
              class="flex items-center gap-2"
            >
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
import { computed, onMounted, provide, ref } from "vue";
import { RouteNames } from "@/router";
import { SvgIcon } from "web-components";
import { UPDATE_BLOCK_INTERVAL } from "@/config/global";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { AppUtils, Logger } from "@/common/utils";

const toggleMobileNav = ref(false);
const toggleMenuWrapper = ref(false);

const filteredRouteNames = computed(() => {
  return Object.values(RouteNames).filter((name) => name !== RouteNames.STATS);
});

const block = ref(0);
const version = ref("");

let blockInterval: NodeJS.Timeout | undefined;

onMounted(() => {
  setBlock();
  setVersion();

  blockInterval = setInterval(() => {
    setBlock();
    blockInterval;
  }, UPDATE_BLOCK_INTERVAL);
});

async function setBlock() {
  try {
    const nolusClient = NolusClient.getInstance();
    block.value = await nolusClient.getBlockHeight();
  } catch (error: Error | any) {
    Logger.error(error);
  }
}

async function setVersion() {
  try {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;

    const data = await fetch(`${url}/abci_info`);
    const res = await data.json();
    version.value = res?.result?.response.version;
  } catch (error: Error | any) {
    Logger.error(error);
  }
}

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
.router-link-exact-active {
  @apply border-b border-t border-border-default bg-neutral-bg-2 text-typography-link shadow-small;

  svg {
    @apply fill-icon-link;
  }
}

.router-link:not(.router-link-exact-active) {
  &:hover {
    @apply border-b border-t border-border-default bg-neutral-bg-2 text-typography-link shadow-small;

    svg {
      @apply fill-icon-link;
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
