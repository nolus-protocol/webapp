<template>
  <DialogHeader :headerList="[$t('message.confirm')]">
    <ClaimMainComponent :reward="reward" :contract-data="contractData" />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import ClaimMainComponent from "@/components/ClaimComponents/ClaimMainComponent.vue";
import type { ContractData } from "@nolus/nolusjs/build/contracts";
import type { PropType } from "vue";
import type { AssetBalance } from "@/stores/wallet/state";

const { reward, contractData } = defineProps({
  reward: {
    type: Object as PropType<AssetBalance>,
    required: true,
  },
  contractData: {
    type: Array as PropType<ContractData[]>,
  },
  // leaseInfo: {
  //   type: Object as PropType<LeaseData>,
  //   required: true
  // }
});
</script>

<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}
</style>
