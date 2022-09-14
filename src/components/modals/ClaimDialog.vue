<template>
  <DialogHeader :headerList="[$t('message.confirm')]">
    <ClaimMainComponent :reward="reward" :contract-data="contractData"/>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'
import ClaimMainComponent from '@/components/ClaimComponents/ClaimMainComponent.vue'
import { ContractData } from '@nolus/nolusjs/build/contracts'
import { PropType } from 'vue'
import { AssetBalance } from '@/store/modules/wallet/state'

const {
  reward,
  contractData
} = defineProps({
  reward: {
    type: Object as PropType<AssetBalance>,
    required: true
  },
  contractData: {
    type: Array as PropType<ContractData[]>
  }
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
