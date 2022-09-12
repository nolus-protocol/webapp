<template>
  <DialogHeader :headerList="[$t('message.confirm')]">
    <ClaimMainComponent :amount="'32'" :selectedAsset="'uusdc'"/>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'
import ClaimMainComponent from '@/components/ClaimComponents/ClaimMainComponent.vue'

defineProps({
  // leaseInfo: {
  //   type: Object as PropType<LeaseData>,
  //   required: true
  // }
})
</script>

<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
</style>
