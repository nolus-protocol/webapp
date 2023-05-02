<template>
  <component
    :is="currentComponent.is"
    v-model="currentComponent.props"
  />
</template>

<script setup lang="ts">
import ReceiveComponent, { type ReceiveComponentProps } from "@/components/ReceiveComponents/ReceiveComponent.vue";
import ReceiveQrCodeComponent, { type ReceiveQrCodeComponentProps } from "@/components/ReceiveComponents/ReceiveQrCodeComponent.vue";

import { inject, onMounted, shallowRef, computed } from "vue";
import { StringUtils, WalletManager } from "@/utils";
import { useWalletStore } from "@/stores/wallet";

interface ReceiveMainComponentData {
  is: typeof ReceiveComponent | typeof ReceiveQrCodeComponent | any;
  props: ReceiveComponentProps | ReceiveQrCodeComponentProps;
}

const ScreenState = {
  MAIN: ReceiveComponent,
  SCAN: ReceiveQrCodeComponent,
};

const walletStore = useWalletStore();
const currentComponent = shallowRef({} as ReceiveMainComponentData);
const hideDialogHeader = () => setShowDialogHeader(false);
const showDialogHeader = () => setShowDialogHeader(true);
const balances = computed(() => walletStore.balances);

const setShowDialogHeader = inject(
  "setShowDialogHeader",
  (bool: Boolean) => { }
);

onMounted(() => {
  currentComponent.value = {
    is: ScreenState.MAIN,
    props: {
      currentBalance: balances.value,
      selectedCurrency: balances.value[0],
      amount: "",
      onScanClick: () => onScanClick(),
      onCopyClick: (wallet) => onCopyClick(wallet),
    },
  };
});

const onScanClick = () => {
  hideDialogHeader();
  currentComponent.value = {
    is: ScreenState.SCAN,
    props: {
      walletAddress: WalletManager.getWalletAddress(),
      onBackClick: () => onBackClick(),
      onCopyClick: (wallet) => onCopyClick(wallet),
    },
  };
};

const onBackClick = () => {
  showDialogHeader();
  currentComponent.value = {
    is: ScreenState.MAIN,
    props: {
      currentBalance: balances.value,
      selectedCurrency: balances.value[0],
      amount: "",
      walletAddress: WalletManager.getWalletAddress() || "",
      onScanClick: () => onScanClick(),
      onCopyClick: (wallet) => onCopyClick(wallet),
    },
  };
};

const onCopyClick = (wallet?: string) => {
  StringUtils.copyToClipboard(wallet ?? WalletManager.getWalletAddress());
};
</script>
