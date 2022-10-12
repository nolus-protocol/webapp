<template>
  <RouterView v-cloak />
  <Modal v-if="showErrorDialog" @close-modal="showErrorDialog = false">
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { RouterView } from "vue-router";

import Modal from '@/components/modals/templates/Modal.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import { UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from '@/config/env';
import { WalletManager } from '@/wallet/WalletManager';
import { useApplicationStore, ApplicationActionTypes } from '@/stores/application';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';
import { useOracleStore, OracleActionTypes } from '@/stores/oracle';

const showErrorDialog = ref(false);
const errorMessage = ref('');
const application = useApplicationStore();
const wallet = useWalletStore();
const oracle = useOracleStore();
let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;

onMounted(async () => {
  await loadNetwork();
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
})

const onClickTryAgain = async () => {
  await loadNetwork();
};

const loadNetwork = async () => {
  try {
    application[ApplicationActionTypes.CHANGE_NETWORK]();
    //TODO: get prices
    Promise.all([
      wallet[WalletActionTypes.UPDATE_BALANCES](),
      // oracle[OracleActionTypes.GET_PRICES]()
    ]);
    checkBalances();
    // checkPrices();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
};

const checkBalances = async () => {
  balanceInterval =setInterval(async () => {
    try {
      if (WalletManager.getWalletAddress() !== '') {
        await wallet[WalletActionTypes.UPDATE_BALANCES]();
      }
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_BALANCE_INTERVAL);
};

const checkPrices = async () => {
   pricesInterval = setInterval(async () => {
    try {
      await oracle[OracleActionTypes.GET_PRICES]();
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_PRICES_INTERVAL);
};
</script>
