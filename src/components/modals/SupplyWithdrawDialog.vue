<template>
  <DialogHeader
    :headerList="[$t('message.supply-title'), $t('message.withdraw-title')]"
    :routes="['supply', 'withdraw']"
    :active-tab="2"
  >
    <template #tab-1>
      <SupplyMainComponent :selectedAsset="selectedAsset"/>
    </template>
    <template #tab-2>
      <WithdrawMainComponent :selectedAsset="selectedAsset"/>
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import SupplyMainComponent from "@/components/SupplyComponents/SupplyMainComponent.vue";
import WithdrawMainComponent from "@/components/WithdrawComponents/WithdrawMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});
</script>
