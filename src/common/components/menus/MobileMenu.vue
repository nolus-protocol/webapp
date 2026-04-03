<template>
  <AnimatePresence>
    <Motion
      v-if="isOpen"
      key="backdrop"
      tag="div"
      :initial="{ opacity: 0 }"
      :animate="{ opacity: 1 }"
      :exit="{ opacity: 0 }"
      :transition="{ duration: 0.25 }"
      class="fixed top-0 left-0 z-99999 h-full w-full bg-neutral-bg-inverted-1/50"
      v-on:click="close"
    />
    <Motion
      v-if="isOpen"
      key="panel"
      tag="div"
      :initial="{ x: '-100%' }"
      :animate="{ x: 0 }"
      :exit="{ x: '-100%' }"
      :transition="{ type: 'spring', stiffness: 300, damping: 30 }"
      class="fixed top-0 left-0 z-99999 flex h-full w-3/4 max-w-96 flex-col bg-neutral-bg-1 landscape:overflow-auto"
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
    </Motion>
  </AnimatePresence>
</template>

<script lang="ts" setup>
import { provide, ref } from "vue";
import { RouteNames } from "@/router";
import SidebarLink from "../SidebarLink.vue";
import { SvgIcon } from "web-components";
import { sidebarIconMap, mainMenuRoutes, routePath } from "./menuConfig";
import { useBlockInfo } from "@/common/composables/useBlockInfo";
import { AnimatePresence, Motion } from "motion-v";

const isOpen = ref(false);

const { block, version } = useBlockInfo();

const open = () => {
  document.body.style.overflow = "hidden";
  isOpen.value = true;
};

const close = () => {
  document.body.style.overflow = "auto";
  isOpen.value = false;
};

provide("open", open);
provide("close", close);

defineExpose({ open, close });
</script>
