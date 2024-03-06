<template>
  <ReceiveComponent v-model="state" />
</template>

<script setup lang="ts">
import ReceiveComponent from "./ReceiveComponent.vue";

import { computed, shallowRef } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { StringUtils, WalletManager } from "@/common/utils";

const walletStore = useWalletStore();
const balances = computed(() => walletStore.balances);
const props = defineProps({
  dialogSelectedCurrency: {
    type: String,
    default: ""
  }
});

const state = shallowRef({
  dialogSelectedCurrency: props.dialogSelectedCurrency,
  currentBalance: balances.value,
  selectedCurrency: balances.value[0],
  amount: "",
  onCopyClick: onCopyClick
});

function onCopyClick(wallet?: string) {
  StringUtils.copyToClipboard(wallet ?? WalletManager.getWalletAddress());
}
</script>
