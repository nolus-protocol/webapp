<template>
  <DialogHeader
    :headerList="[$t('message.delegate-title'), $t('message.undelegate-title')]"
    :routes="['delegate', 'undelegate']"
    :active-tab="isDelegated ? 2 : 1"
  >
    <template #tab-1>
      <DelegateMainComponent :selectedAsset="selectedAsset" />
    </template>
    <template #tab-2>
      <UndelegateMainComponent :selectedAsset="selectedAsset" />
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DelegateMainComponent from "@/components/DelegateComponents/DelegateMainComponent.vue";
import UndelegateMainComponent from "@/components/UndelegateComponents/UndelegateMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
  isDelegated: {
    type: Boolean,
    default: false
  },
});
</script>
