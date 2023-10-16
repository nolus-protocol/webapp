<template>
  <DialogHeader :headerList="[$t('message.market-close')]">
    <MarketCloseMainComponent :leaseData="leaseInfo"/>
  </DialogHeader>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";
import type { LeaseData } from "@/types";

import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import MarketCloseMainComponent from "@/components/MarketCloseComponents/MarketCloseMainComponent.vue";

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
