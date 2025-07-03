<template>
  <div class="flex items-center gap-3 p-2 lg:rounded-full lg:bg-neutral-bg-3">
    <div class="flex gap-1">
      <Activities />
      <Settings />
      <i class="block border-r border-border-default" />
    </div>
    <div class="flex h-8 gap-2">
      <Dropdown
        id="header"
        class="border-none bg-transparent focus:px-2 focus:py-1 lg:w-32"
        :size="Size.small"
        :options="options"
        :selected="option"
        :on-select="onSelect"
        :hideText="isMobile()"
        :position="isMobile() ? 'right' : 'left'"
      />
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
import { Dropdown, Size } from "web-components";
import { isMobile, WalletManager } from "@/common/utils";

import WalletInfo from "../WalletInfo.vue";
import AuthDialog from "../dialogs/AuthDialog.vue";
import Disconnect from "../auth/Disconnect.vue";

import Activities from "@/common/components/activities/Activities.vue";
import Settings from "@/common/components/settings/Settings.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { Contracts } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { useRouter } from "vue-router";
import { ref } from "vue";
import { useOracleStore } from "@/common/stores/oracle";

const wallet = useWalletStore();
const app = useApplicationStore();
const oracle = useOracleStore();

const router = useRouter();
const disconnect = ref<typeof Disconnect>();

const options = Object.keys(Contracts.protocolsFilter).map((item) => {
  const protocol = Contracts.protocolsFilter[item];
  return {
    value: protocol.key,
    label: protocol.name,
    icon: protocol.image
  };
});
const option = options.find((item) => item.value == WalletManager.getProtocolFilter());

async function onSelect(item: { value: string; label: string; icon: string }) {
  app.setProtcolFilter(item.value);
  await oracle.GET_PRICES();
  router.push("/");
}
</script>

<style scoped lang=""></style>
