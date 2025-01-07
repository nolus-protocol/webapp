<template>
  <div class="flex items-center gap-3 p-2 lg:rounded-full lg:bg-neutral-bg-3">
    <div class="flex gap-1">
      <Activities />
      <Settings />
      <i class="block border-r border-border-default" />
    </div>
    <div class="flex h-8 gap-2">
      <Dropdown
        class="border-none bg-transparent focus:px-2 focus:py-1 lg:w-32"
        :size="Size.small"
        :options="options"
        :selected="options[0]"
        :on-select="() => {}"
        :hideText="isMobile()"
        dropdownPosition="right"
      />
      <WalletInfo v-if="wallet.wallet" />
      <AuthDialog v-else />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Dropdown, Size } from "web-components";
import { isMobile } from "@/common/utils";

import WalletInfo from "../WalletInfo.vue";
import AuthDialog from "../dialogs/AuthDialog.vue";
import Settings from "@/common/components/settings/Settings.vue";
import { useWalletStore } from "@/common/stores/wallet";
import Activities from "@/common/components/activities/Activities.vue";

const wallet = useWalletStore();

const options = [
  {
    value: "osmosis",
    label: "Osmosis",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/osmosis-osmo.svg"
  },
  {
    value: "neutron",
    label: "Neutron",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/neutron-ntrn.svg"
  },
  {
    value: "nolus",
    label: "Nolus",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/osmosis-nls.svg"
  }
];
</script>

<style scoped lang=""></style>
