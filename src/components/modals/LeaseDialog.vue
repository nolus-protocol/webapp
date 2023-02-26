<template>
  <DialogHeader :headerList="[$t('message.lease')]">
    <LeaseMainComponent :selectedAsset="selectedAsset" />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import LeaseMainComponent from "@/components/LeaseComponents/LeaseMainComponent.vue";

defineProps({
  selectedAsset: {
    type: String
  }
})

</script>
