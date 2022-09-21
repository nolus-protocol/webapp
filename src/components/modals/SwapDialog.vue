<template>
  <DialogHeader :headerList="[$t('message.swap')]">
    <SwapMainComponent />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'
import SwapMainComponent from '@/components/SwapComponents/SwapMainComponent.vue'
</script>
