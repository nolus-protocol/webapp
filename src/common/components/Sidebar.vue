<template>
  <div class="fixed left-0 top-0 hidden h-full w-full max-w-[210px] flex-col justify-between pb-8 pl-8 pt-28 lg:flex">
    <DesktopMenu class="flex flex-col gap-3" />
    <div class="flex flex-col gap-1">
      <RouterLink
        :to="{ name: RouteNames.VOTE }"
        class="router-link group flex h-[50px] items-center gap-2 rounded-full border border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
      >
        <SidebarIcon icon="vote" />
        {{ $t("message.vote") }}
      </RouterLink>
      <RouterLink
        :to="{ name: RouteNames.STATS }"
        class="router-link group flex h-[50px] items-center gap-2 rounded-full border border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
      >
        <SidebarIcon icon="stats" />
        {{ $t("message.stats") }}
      </RouterLink>
      <p class="text-upper text-center text-12 text-typography-secondary">
        #
        <template v-if="block > 0">{{ block }} v{{ version }}</template>
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { RouteNames } from "@/router";
import DesktopMenu from "@/common/components/menus/DesktopMenu.vue";
import SidebarIcon from "@/common/components/icons/SidebarIcon.vue";
import { useBlockInfo } from "@/common/composables/useBlockInfo";

const { block, version } = useBlockInfo();
</script>

<style lang="scss" scoped>
.router-link-active {
  @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;

  svg {
    @apply fill-icon-link;
  }
}

.router-link:not(.router-link-active) {
  &:hover {
    @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;
  }
}
</style>
