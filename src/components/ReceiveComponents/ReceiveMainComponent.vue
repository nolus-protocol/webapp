<template>
  <component :is="currentComponent.is" v-model="currentComponent.props" />
</template>

<script setup lang="ts">
import ReceiveComponent, { type ReceiveComponentProps } from '@/components/ReceiveComponents/ReceiveComponent.vue';
import ReceiveQrCodeComponent, { type ReceiveQrCodeComponentProps } from '@/components/ReceiveComponents/ReceiveQrCodeComponent.vue';

import { inject, onMounted, shallowRef } from 'vue';
import { WalletManager, StringUtils } from '@/utils';

interface ReceiveMainComponentData {
  is: typeof ReceiveComponent | typeof ReceiveQrCodeComponent;
  props: ReceiveComponentProps | ReceiveQrCodeComponentProps;
}

const ScreenState = {
  MAIN: ReceiveComponent,
  SCAN: ReceiveQrCodeComponent,
};

const currentComponent = shallowRef({} as ReceiveMainComponentData);
const hideDialogHeader = () => setShowDialogHeader(false);
const showDialogHeader = () => setShowDialogHeader(true);

const setShowDialogHeader = inject(
  'setShowDialogHeader',
  (bool: Boolean) => {}
);

onMounted(() => {
  currentComponent.value = {
    is: ScreenState.MAIN,
    props: {
      walletAddress: WalletManager.getWalletAddress(),
      onScanClick: () => onScanClick(),
      onCopyClick: () => onCopyClick(),
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
      onCopyClick: () => onCopyClick(),
    },
  };
};

const onCopyClick = () => {
  StringUtils.copyToClipboard(currentComponent.value.props.walletAddress);
};

const onBackClick = () => {
  showDialogHeader();
  currentComponent.value = {
    is: ScreenState.MAIN,
    props: {
      walletAddress: WalletManager.getWalletAddress() || '',
      onScanClick: () => onScanClick(),
      onCopyClick: () => onCopyClick(),
    },
  };
};
</script>
