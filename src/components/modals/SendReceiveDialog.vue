<template>
  <DialogHeader :headerList="[$t('message.receive'), $t('message.send')]"
                :routes="['receive', 'send']">
    <template #tab-1>
      <ReceiveMainComponent :dialogSelectedCurrency="props.dialogSelectedCurrency" />
    </template>
    <template #tab-2>
      <SendMainComponent :dialogSelectedCurrency="props.dialogSelectedCurrency" />
    </template>

  </DialogHeader>
</template>

<script lang="ts" setup>
import SendMainComponent from "@/components/SendComponents/SendMainComponent.vue";
import ReceiveMainComponent from "@/components/ReceiveComponents/ReceiveMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

const props = defineProps({
  dialogSelectedCurrency: {
    type: String,
    default: ''
  }
})
</script>
