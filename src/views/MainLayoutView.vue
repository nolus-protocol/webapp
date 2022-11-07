<template>
  <div
    v-cloak
    class="lg:container w-full lg:grid lg:grid-cols-12 grid-parent md-nls-px-25 sm-nls-0 body background-dark"
  >
    <div class="lg:col-span-3">
      <SidebarContainer />
    </div>
    <div class="lg:col-span-9 pb-8">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-[65px]">
          <div class="col-span-12">
            <div class="sidebar-header">
              <SidebarHeader />
            </div>
          </div>
        </div>
        <div class="col-span-12 mobile-scroll">
          <router-view />
        </div>
      </div>
    </div>
    <Snackbar 
      ref="snackbar"
      :type="snackbarState.type"
      :transaction="snackbarState.transaction">
    </Snackbar>
  </div>
</template>

<script lang="ts" setup>
import SidebarContainer from '@/components/SidebarContainer.vue';
import SidebarHeader from '@/components/Sideheader.vue';
import Snackbar from '@/components/templates/utils/Snackbar.vue';
import { SNACKBAR, UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from '@/config/env';
import { OracleActionTypes, useOracleStore } from '@/stores/oracle';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';
import { WalletManager } from '@/wallet/WalletManager';
import { onMounted, onUnmounted, provide, ref, type Ref } from 'vue';

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;
const wallet = useWalletStore();
const oracle = useOracleStore();
const snackbar: Ref<typeof Snackbar> = ref(Snackbar);

const showErrorDialog = ref(false);
const errorMessage = ref('');
const snackbarState = ref({
  type: SNACKBAR.Queued,
  transaction: 'transaction'
});

onMounted(async () => {
  await loadNetwork();
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
})

const loadNetwork = async () => {
  try {
    await Promise.all([
      wallet[WalletActionTypes.UPDATE_BALANCES](),
      oracle[OracleActionTypes.GET_PRICES]()
    ]);
    checkBalances();
    checkPrices();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
};

const checkBalances = async () => {
  balanceInterval = setInterval(async () => {
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

const showSnackbar = (type: SNACKBAR, transaction: string) => {
  snackbarState.value.type = type;
  snackbarState.value.transaction = transaction;

  snackbar.value.openSnackBar();
}

provide('showSnackbar', showSnackbar);

</script>