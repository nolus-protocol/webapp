<template>
  <div class="flex items-center gap-3 p-2 lg:rounded-full lg:bg-neutral-bg-3">
    <div class="flex gap-1">
      <Activities />
      <Settings />
      <i class="block border-r border-border-default" />
    </div>
    <div class="flex h-8 gap-2">
      <WalletInfo
        v-if="wallet.wallet"
        @onDisconnect="disconnect?.show()"
      />
      <AuthDialog v-else />
      <Disconnect ref="disconnect" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import WalletInfo from "../WalletInfo.vue";
import AuthDialog from "../dialogs/AuthDialog.vue";
import Disconnect from "../auth/Disconnect.vue";

import Activities from "@/common/components/activities/Activities.vue";
import Settings from "@/common/components/settings/Settings.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { ref } from "vue";

const wallet = useWalletStore();
const disconnect = ref<typeof Disconnect>();
</script>

<style scoped lang=""></style>
