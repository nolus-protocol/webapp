<template>
  <DialogHeader
    :headerList="[$t('message.send'), $t('message.receive')]"
    :routes="['send', 'receive']"
  >
    <template #tab-1>
      <SendMainComponent />
    </template>
    <template #tab-2>
      <ReceiveMainComponent />
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import SendMainComponent from "@/components/SendComponents/SendMainComponent.vue";
import ReceiveMainComponent from "@/components/ReceiveComponents/ReceiveMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";
</script>
