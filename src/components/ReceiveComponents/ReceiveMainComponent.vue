<template>
  <component
    :is="currentComponent.is"
    v-model="currentComponent.props"
  />
</template>

<script setup lang="ts">
import ReceiveComponent, { type ReceiveComponentProps } from "@/components/ReceiveComponents/ReceiveComponent.vue";
import ReceiveQrCodeComponent, { type ReceiveQrCodeComponentProps } from "@/components/ReceiveComponents/ReceiveQrCodeComponent.vue";

import { inject, onMounted, shallowRef, computed, watch } from "vue";
import { StringUtils, WalletManager } from "@/utils";
import { useWalletStore } from "@/stores/wallet";
import { storeToRefs } from "pinia";

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
const walletRef = storeToRefs(walletStore);
const props = defineProps({
  dialogSelectedCurrency: {
    type: String,
    default: ''
  }
});

const setShowDialogHeader = inject(
  "setShowDialogHeader",
  (bool: Boolean) => { }
);

watch(() => walletRef.wallet.value?.address, () => {
  switch (currentComponent.value.is) {
    case (ScreenState.MAIN): {
      setMainComponent();
      break;
    }
    case (ScreenState.SCAN): {
      setScanComponent();
      break;
    }
  }
});

onMounted(() => {
  setMainComponent();
});

function setScanComponent() {
  hideDialogHeader();
  currentComponent.value = {
    is: ScreenState.SCAN,
    props: {
      dialogSelectedCurrency: props.dialogSelectedCurrency,
      walletAddress: walletStore.wallet?.address ?? WalletManager.getWalletAddress(),
      onBackClick: () => onBackClick(),
      onCopyClick: (wallet) => onCopyClick(wallet),
    },
  };
}

function setMainComponent() {
  showDialogHeader();
  currentComponent.value = {
    is: ScreenState.MAIN,
    props: {
      dialogSelectedCurrency: props.dialogSelectedCurrency,
      currentBalance: balances.value,
      selectedCurrency: balances.value[0],
      amount: "",
      onScanClick: () => onScanClick(),
      onCopyClick: (wallet) => onCopyClick(wallet),
    },
  };
}

function onScanClick() {
  setScanComponent();
};

function onBackClick() {
  setMainComponent();
};

function onCopyClick(wallet?: string) {
  StringUtils.copyToClipboard(wallet ?? WalletManager.getWalletAddress());
};
</script>
