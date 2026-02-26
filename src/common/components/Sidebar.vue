<template>
  <div class="fixed top-0 left-0 hidden h-full w-full max-w-[210px] flex-col justify-between pt-28 pb-8 pl-8 lg:flex">
    <DesktopMenu class="flex flex-col gap-3" />
    <div class="flex flex-col gap-1">
      <SidebarLink
        :to="{ name: RouteNames.VOTE }"
        icon="vote"
        :content="$t('message.vote')"
      />
      <SidebarLink
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
</template>

<script lang="ts" setup>
import { RouteNames } from "@/router";
import DesktopMenu from "@/common/components/menus/DesktopMenu.vue";
import SidebarLink from "./SidebarLink.vue";
import { useBlockInfo } from "@/common/composables/useBlockInfo";

const { block, version } = useBlockInfo();
</script>
