<template>
  <DialogHeader
    :headerList="['Delegate', 'Undelegate']"
    :routes="['delegate', 'undelegate']"
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
import DelegateMainComponent from "@/components/DelegateComponents/DeleateMainComponent.vue";
import UndelegateMainComponent from "@/components/UndelegateComponents/UndelegateMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

defineProps({
  selectedAsset: {
    type: String,
    required: true,
  },
});
</script>
