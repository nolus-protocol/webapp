<template>
  <div
    class="router-box lg:container w-full lg:grid lg:grid-cols-12 grid-parent md-nls-px-25 sm-nls-0 body background-dark"
  >
    <div class="lg:col-span-3 sidebar">
      <SidebarContainer />
    </div>
    <div class="lg:col-span-9 pb-8 view">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-[65px] z-[3]">
          <div class="col-span-12">
            <div class="sidebar-header">
              <SidebarHeader />
            </div>
          </div>
        </div>
        <div class="col-span-12 mobile-scroll container-view">
          <router-view v-slot="{ Component, route }">
            <transition
              name="fade"
              mode="out-in"
              appear
            >
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
  <Modal
    v-if="app.sessionExpired"
    route="alert"
    :disable-close="true"
    @close-modal="refresh()"
  >
    <SessionExpireDialog :close="refresh" />
  </Modal>
</template>

<script lang="ts" setup>
import SidebarContainer from "@/components/SidebarContainer.vue";
import SidebarHeader from "@/components/Sideheader.vue";
import Snackbar from "@/components/templates/utils/Snackbar.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import SessionExpireDialog from "@/components/modals/SessionExpireDialog.vue";

import { OracleActionTypes, useOracleStore } from "@/stores/oracle";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { WalletManager } from "@/utils";
import { onMounted, onUnmounted, provide, ref, type Ref } from "vue";
// import { Squid, } from "@0xsquid/sdk";

import { SESSION_TIME, SNACKBAR, SquidRouter, UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL, } from "@/config/env";
import { ApplicationActionTypes, useApplicationStore } from "@/stores/application";

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;
let sessionTimeOut: NodeJS.Timeout | undefined;

const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

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
  window.addEventListener("leap_keystorechange", updateLeap);
  window.addEventListener('focus', stopTimer);
  window.addEventListener('blur', startTimer);

  // test();
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval)
  clearInterval(sessionTimeOut);
  window.removeEventListener("keplr_keystorechange", updateKeplr);
  window.addEventListener("leap_keystorechange", updateLeap);
  window.removeEventListener('focus', stopTimer);
  window.removeEventListener('blur', startTimer);
});

async function updateKeplr() {
  try {
    await wallet[WalletActionTypes.CONNECT_KEPLR]({ isFromAuth: true });
    await loadNetwork();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message
  }
}

async function updateLeap() {
  try {
    await wallet[WalletActionTypes.CONNECT_LEAP]({ isFromAuth: true });
    await loadNetwork();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message
  }
}

async function connect() {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  await loadNetwork();
};

async function loadNetwork() {
  try {
    await Promise.all([
      wallet[WalletActionTypes.UPDATE_BALANCES](),
      wallet[WalletActionTypes.LOAD_APR](),
      oracle[OracleActionTypes.GET_PRICES](),
      app[ApplicationActionTypes.LOAD_APR_REWARDS](),
    ]);
    checkBalances();
    checkPrices();
  } catch (error: Error | any) {
    console.log(error)
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
};

async function checkBalances() {
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

async function checkPrices() {
  pricesInterval = setInterval(async () => {
    try {
      await oracle[OracleActionTypes.GET_PRICES]();
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_PRICES_INTERVAL);
};

function showSnackbar(type: SNACKBAR, transaction: string) {
  snackbarState.value.type = type;
  snackbarState.value.transaction = transaction;

  snackbar.value.openSnackBar(type);
};

function snackbarVisible() {
  return snackbar.value.snackbarVisible();
};

function startTimer() {
  if (sessionTimeOut) {
    clearInterval(sessionTimeOut)
  }
  sessionTimeOut = setTimeout(() => {
    app.sessionExpired = true;
    clearInterval(balanceInterval);
    clearInterval(pricesInterval);
  }, SESSION_TIME);
}

function stopTimer() {
  if (sessionTimeOut) {
    clearInterval(sessionTimeOut)
  }
}

function refresh() {
  window.location.reload();
}

// async function test() {
//   try {
//     const squid = new Squid(SquidRouter);
//     await squid.init();
//     console.log(squid)

//     const arbitrumChainId = "42161"; // Arbitrum
//     const baseChainId = "8453"; // Base
//     const nativeToken = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
//     const baseUsdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

//     // Define amount to be sent
//     const amount = "10000000000000000";

//     const params = {
//       fromAddress: '0xf5eeD07FeF19987A9f575C01F18e90F649eddB4A',
//       fromChain: arbitrumChainId,
//       fromToken: nativeToken,
//       fromAmount: amount,
//       toChain: baseChainId,
//       toToken: baseUsdc,
//       toAddress: '0xf5eeD07FeF19987A9f575C01F18e90F649eddB4A',
//       slippage: 1,
//       slippageConfig: {
//         autoMode: 1,
//       },
//       quoteOnly: false,
//     };
//     const { route, requestId } = await squid.getRoute(params);
//     console.log(route, requestId)
//   } catch (e) {
//     console.log(e)
//   }

// }

provide("showSnackbar", showSnackbar);
provide("snackbarVisible", snackbarVisible);
</script>

<style scoped lang="scss">
div.router-box {
  width: 100%;
  height: 100%;
  max-width: 100%;
}

@media (max-width: 880px) {
  div.container-view {
    margin-bottom: 16px;
  }
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
