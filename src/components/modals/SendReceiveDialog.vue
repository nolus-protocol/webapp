<template>
  <DialogHeader
    :headerList="[$t('message.receive'), $t('message.send')]"
    :routes="['receive', 'send']"
  >
    <template #tab-1>
      <ReceiveMainComponent />
    </template>
    <template #tab-2>
      <SendMainComponent />
    </template>

  </DialogHeader>
</template>

<script lang="ts" setup>
import SendMainComponent from "@/components/SendComponents/SendMainComponent.vue";
import ReceiveMainComponent from "@/components/ReceiveComponents/ReceiveMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";
</script>
