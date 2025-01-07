<template>
  <div class="flex flex-col gap-8">
    <ListHeader
      :title="wallet?.walletName ? `${$t('message.hello')} ${wallet?.walletName}!` : $t('message.hello-stranger')"
    />
    <DashboardLeases />
    <div class="flex flex-col gap-8 lg:flex-row">
      <DashboardAssets class="lg:flex-[60%]" />
      <DashboardRewards class="lg:flex-[40%] lg:self-start" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useWalletStore } from "@/common/stores/wallet";
import { DashboardAssets, DashboardLeases, DashboardRewards } from "./components";
import ListHeader from "@/common/components/ListHeader.vue";

const wallet = useWalletStore();
</script>
<style lang="scss" scoped></style>
