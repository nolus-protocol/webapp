<template>
  <div
    class="router-box lg:container w-full lg:grid lg:grid-cols-12 grid-parent md-nls-px-25 sm-nls-0 body background-dark"
  >
    <div class="lg:col-span-3 sidebar">
      <SidebarContainer />
    </div>
    <div class="lg:col-span-9 pb-8 view">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-[65px]">
          <div class="col-span-12">
            <div class="sidebar-header">
              <SidebarHeader />
            </div>
          </div>
        </div>
        <div class="col-span-12 mobile-scroll container-view">
          <router-view v-slot="{ Component, route }">
            <transition name="fade" mode="out-in" appear>
              <div :key="route.name!">  
                <component :is="Component"></component>
              </div>
            </transition>
          </router-view>
        </div>
      </div>
    </div>
    <Snackbar
      ref="snackbar"
      :type="snackbarState.type"
      :transaction="snackbarState.transaction"
    >
    </Snackbar>
  </div>
  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="connect"
    />
  </Modal>
</template>

<script lang="ts" setup>
import SidebarContainer from "@/components/SidebarContainer.vue";
import SidebarHeader from "@/components/Sideheader.vue";
import Snackbar from "@/components/templates/utils/Snackbar.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";

import { OracleActionTypes, useOracleStore } from "@/stores/oracle";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { WalletManager } from "@/utils";
import { onMounted, onUnmounted, provide, ref, type Ref } from "vue";

import {
  SNACKBAR,
  UPDATE_BALANCE_INTERVAL,
  UPDATE_PRICES_INTERVAL,
} from "@/config/env";

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;
const wallet = useWalletStore();
const oracle = useOracleStore();
const snackbar: Ref<typeof Snackbar> = ref(Snackbar);

const showErrorDialog = ref(false);
const errorMessage = ref("");
const snackbarState = ref({
  type: SNACKBAR.Queued,
  transaction: "transaction",
});

onMounted(async () => {
  await loadNetwork();
  window.addEventListener("keplr_keystorechange", updateKeplr);
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  window.removeEventListener("keplr_keystorechange", updateKeplr);
});

const updateKeplr = async () => {
  try {
  await wallet[WalletActionTypes.CONNECT_KEPLR]({ isFromAuth: true });
  await loadNetwork();
} catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message
  }
}

const connect = async () => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  await loadNetwork();
};

const loadNetwork = async () => {
  try {
    await Promise.all([
      wallet[WalletActionTypes.UPDATE_BALANCES](),
      wallet[WalletActionTypes.LOAD_APR](),
      oracle[OracleActionTypes.GET_PRICES](),
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
      if (WalletManager.getWalletAddress() !== "") {
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

  snackbar.value.openSnackBar(type);
};

const snackbarVisible = () => {
  return snackbar.value.snackbarVisible();
};

provide("showSnackbar", showSnackbar);
provide("snackbarVisible", snackbarVisible);
</script>

<style scoped lang="scss">
div.router-box {
  width: 100%;
  max-width: 100%;
}

@media (min-width: 1024px) {
  div.router-box {
    div.container-view {
      width: 760px;
      margin: 0 auto;
    }

    div.sidebar {
      grid-column: span 2 / span 2;
    }

    div.view {
      grid-column: span 10 / span 10;
    }
  }
}

@media (min-width: 1120px) {
  div.router-box {
    div.container-view {
      width: 960px;
      margin: 0;
    }

    div.sidebar {
      grid-column: span 2 / span 2;
    }

    div.view {
      grid-column: span 10 / span 10;
    }
  }
}

@media (min-width: 1320px) {
  div.router-box {
    div.container-view {
      width: 1020px;
      margin: 0;
    }

    div.sidebar {
      grid-column: span 2 / span 2;
    }

    div.view {
      grid-column: span 10 / span 10;
    }
  }
}

@media (min-width: 1520px) {
  div.router-box {
    div.container-view {
      width: 1080px;
      margin: 0 auto;
    }

    div.sidebar {
      grid-column: span 1 / span 1;
    }

    div.view {
      grid-column: span 11 / span 11;
    }
  }
}

@media (min-width: 1920px) {
  div.router-box {
    div.container-view {
      width: 1280px;
      margin: 0 auto;
    }

    div.sidebar {
      grid-column: span 1 / span 1;
    }

    div.view {
      grid-column: span 11 / span 11;
    }
  }
}
</style>
