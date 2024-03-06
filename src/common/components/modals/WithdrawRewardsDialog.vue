<template>
  <DialogHeader :headerList="[$t('message.confirm')]">
    <WithdrawRewardsComponents :amount="amount" />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import WithdrawRewardsComponents from "@/common/components/modals/withdraw-rewards/WithdrawRewarsMainComponent.vue";

import type { AssetBalance } from "@/common/stores/wallet/types";
import type { PropType } from "vue";

defineProps({
  amount: {
    type: Object as PropType<AssetBalance>,
    required: true
  }
});
</script>

<style scoped>
.modal-send-receive-actions {
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}
</style>
