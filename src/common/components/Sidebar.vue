<template>
  <div class="fixed left-0 top-0 hidden h-full w-full max-w-[210px] flex-col justify-between pb-8 pl-8 pt-28 lg:flex">
    <DesktopMenu class="flex flex-col gap-3" />
    <div class="flex flex-col gap-1">
      <RouterLink
        :to="{ name: RouteNames.STATS }"
        class="router-link flex h-[50px] items-center gap-2 rounded-full border border-transparent px-4 py-3 text-16 font-semibold text-typography-default transition-colors duration-200"
      >
        <SvgIcon
          name="bar-chart"
          size="l"
        />
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
import { onMounted, ref } from "vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { AppUtils, Logger } from "@/common/utils";
import { UPDATE_BLOCK_INTERVAL } from "@/config/global";
import { RouteNames } from "@/router";

import DesktopMenu from "@/common/components/menus/DesktopMenu.vue";
import { SvgIcon } from "web-components";

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
</script>

<style lang="scss" scoped>
.router-link-exact-active {
  @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;

  svg {
    @apply fill-icon-link;
  }
}

.router-link:not(.router-link-exact-active) {
  &:hover {
    @apply rounded-full border border-border-default bg-neutral-bg-2 text-typography-link shadow-small;

    svg {
      @apply fill-icon-link;
    }
  }
}
</style>
