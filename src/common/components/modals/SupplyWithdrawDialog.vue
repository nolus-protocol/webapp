<template>
  <DialogHeader
    :active-tab="activeTab()"
    :headerList="[$t('message.supply-title'), $t('message.withdraw-title')]"
    :routes="routes"
  >
    <template #tab-1>
      <SupplyMainComponent :selectedAsset="selectedAsset" />
    </template>
    <template #tab-2>
      <WithdrawMainComponent :selectedAsset="selectedAsset" />
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import SupplyMainComponent from "./supply/SupplyMainComponent.vue";
import WithdrawMainComponent from "./withdraw/WithdrawMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

const routes = ["supply", "withdraw"];

const props = defineProps({
  selectedAsset: {
    type: String
  },
  route: {
    type: String
  }
});

const activeTab = () => {
  const index = routes.indexOf(props.route as string);

  if (index < 0) {
    return 1;
  }

  return index + 1;
};
</script>
