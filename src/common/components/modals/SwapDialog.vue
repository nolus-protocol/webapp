<template>
  <DialogHeader :headerList="[$t('message.swap')]">
    <SwapMainComponent />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import SwapMainComponent from "@/common/components/modals/swap/SwapMainComponent.vue";
</script>
