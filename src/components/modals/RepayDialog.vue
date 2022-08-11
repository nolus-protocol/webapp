<template>
  <DialogHeader :headerList="[$t('message.repay')]">
    <RepayMainComponent :leaseData="leaseInfo" />
  </DialogHeader>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'

import DialogHeader from '@/components/modals/templates/DialogHeader.vue'
import RepayMainComponent from '@/components/RepayComponents/RepayMainComponent.vue'
import { LeaseData } from '@/types/LeaseData'

defineProps({
  leaseInfo: {
    type: Object as PropType<LeaseData>,
    required: true
  }
})
</script>

<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
</style>
