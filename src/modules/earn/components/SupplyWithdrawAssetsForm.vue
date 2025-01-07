<template>
  <template v-if="type == EarnAssetsDialog.SUPPLY">
    <SupplyForm />
  </template>

  <template v-if="type == EarnAssetsDialog.WITHDRAW">
    <WithdrawForm />
  </template>
</template>

<script lang="ts" setup>
import { EarnAssetsDialog } from "@/modules/earn/enums";
import SupplyForm from "./SupplyForm.vue";
import WithdrawForm from "./WithdrawForm.vue";

defineProps<{
  type: EarnAssetsDialog.SUPPLY | EarnAssetsDialog.WITHDRAW;
}>();
</script>
