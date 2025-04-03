<template>
  <div class="flex flex-col gap-8">
    <ListHeader
      :title="wallet?.walletName ? `${$t('message.hello')} ${wallet?.walletName}!` : $t('message.hello-stranger')"
    />
    <DashboardLeases :isVisible="isVisible" />
    <div class="flex flex-col gap-8 lg:flex-row">
      <DashboardAssets
        :isVisible="isVisible"
        class="lg:flex-[60%]"
      />
      <DashboardRewards
        :show-empty="!isVisible"
        class="lg:flex-[40%] lg:self-start"
      />
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import { useWalletStore } from "@/common/stores/wallet";
import { DashboardAssets, DashboardLeases, DashboardRewards } from "./components";
import ListHeader from "@/common/components/ListHeader.vue";
import { computed } from "vue";
import { WalletManager } from "@/common/utils";

const wallet = useWalletStore();

const isVisible = computed(() => {
  const w = WalletManager.getPubKey()?.length ?? 0;
  return !!wallet?.wallet || w > 0;
});
</script>
