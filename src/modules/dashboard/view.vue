<template>
  <div class="flex flex-col gap-8">
    <ListHeader
      :title="wallet?.wallet?.address ? `${$t('message.hello')}, ${funkyName}` : $t('message.hello-stranger')"
    />
    <DashboardLeases />
    <div class="flex flex-col gap-8 lg:flex-row">
      <DashboardAssets class="lg:flex-[60%]" />
      <DashboardRewards class="lg:flex-[40%] lg:self-start" />
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { DashboardAssets, DashboardLeases, DashboardRewards } from "./components";
import ListHeader from "@/common/components/ListHeader.vue";

const wallet = useWalletStore();

const ADJECTIVES = [
  "Cosmic",
  "Stellar",
  "Brave",
  "Swift",
  "Noble",
  "Zen",
  "Lucky",
  "Bold",
  "Vivid",
  "Epic",
  "Funky",
  "Bright",
  "Chill",
  "Daring",
  "Fierce",
  "Grand",
  "Happy",
  "Jolly",
  "Keen",
  "Lively",
  "Mighty",
  "Nifty",
  "Plucky",
  "Quick",
  "Rad",
  "Slick",
  "Turbo",
  "Ultra",
  "Witty",
  "Zesty",
  "Atomic",
  "Blazing"
];

const NOUNS = [
  "Panda",
  "Falcon",
  "Otter",
  "Fox",
  "Wolf",
  "Lynx",
  "Raven",
  "Tiger",
  "Comet",
  "Nova",
  "Pixel",
  "Spark",
  "Orbit",
  "Pulse",
  "Reef",
  "Bolt",
  "Crane",
  "Drake",
  "Flint",
  "Gecko",
  "Hawk",
  "Ibex",
  "Jade",
  "Kite",
  "Lotus",
  "Mango",
  "Opal",
  "Pike",
  "Quail",
  "Sage",
  "Viper",
  "Wren"
];

function addressToName(address: string): string {
  const tail = address.slice(-6);
  let hash = 0;
  for (let i = 0; i < tail.length; i++) {
    hash = (hash * 31 + tail.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  return `${ADJECTIVES[hash % ADJECTIVES.length]} ${NOUNS[(hash >>> 5) % NOUNS.length]}`;
}

const funkyName = computed(() => {
  const address = wallet.wallet?.address;
  return address ? addressToName(address) : "";
});
</script>
