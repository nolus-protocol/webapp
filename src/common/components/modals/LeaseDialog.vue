<template>
  <DialogHeader :headerList="[$t('message.lease')]">
    <LeaseMainComponent :selectedAsset="selectedAsset" />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import LeaseMainComponent from "./lease/LeaseMainComponent.vue";

defineProps({
  selectedAsset: {
    type: String
  }
});
</script>
