<template>
  <DialogHeader :headerList="[$t('message.repay')]">
    <RepayMainComponent :leaseData="leaseInfo" class="overflow-auto"/>
  </DialogHeader>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";
import type { LeaseData } from "@/types";

import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import RepayMainComponent from "@/components/RepayComponents/RepayMainComponent.vue";

defineProps({
  leaseInfo: {
    type: Object as PropType<LeaseData>,
    required: true,
  },
});
</script>

<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}
</style>
