<template>
  <div
    class="sidebar-container fixed left-0 top-0 hidden h-full w-full max-w-[210px] flex-col justify-between py-8 pl-8 lg:flex"
  >
    <div class="flex flex-col gap-20">
      <Logo class="!static" />
      <DesktopMenu class="flex flex-col gap-4" />
    </div>
    <div class="flex flex-col">
      <div class="mb-[6px] flex flex-col gap-1 font-garet-medium">
        <a
          class="sidebar-element flex items-center gap-1 text-12"
          href="https://hub.nolus.io"
          target="_blank"
        >
          <span class="icon icon-hat" />
          {{ $t("message.support") }}
        </a>
        <RouterLink
          :to="{ name: RouteNames.STATS }"
          class="sidebar-element flex items-center gap-1 text-12"
        >
          <span class="icon icon-stats" />
          {{ $t("message.protocol-stats") }}
        </RouterLink>
      </div>
      <p class="text-upper font-garet-medium text-12 text-neutral-400">
        #<template v-if="block > 0">{{ block }} v{{ version }}</template>
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

import Logo from "@/common/components/Logo.vue";
import DesktopMenu from "@/common/components/menus/DesktopMenu.vue";

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
  @apply text-orange-active;
}
</style>
