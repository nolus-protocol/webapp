<template>
  <div class="router-box flex min-h-screen w-full">
    <Header />
    <Sidebar />
    <MobileMenu />
    <div class="custom-scroll flex w-full flex-1 justify-center pb-20 pt-20 lg:ml-[210px] lg:pb-8">
      <router-view v-slot="{ Component, route }">
        <transition
          appear
          mode="out-in"
          name="fade"
        >
          <div
            :key="route.name!"
            class="container-view w-full"
          >
            <component :is="Component"></component>
          </div>
        </transition>
      </router-view>
    </div>
  </div>
  <Modal
    v-if="app.sessionExpired"
    :disable-close="true"
    route="alert"
    @close-modal="refresh()"
  >
    <SessionExpireDialog :close="refresh" />
  </Modal>
  <Modal
    v-if="showModal"
    :route="modalOptions[modalAction].route"
    @close-modal="showModal = false"
  >
    <component
      :is="modalOptions[modalAction].dialog"
      :route="modalOptions[modalAction].route"
    />
  </Modal>
  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="connect"
    />
  </Modal>
</template>

<script lang="ts" setup>
import { type Component, onMounted, provide, ref, onUnmounted } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { SESSION_TIME, UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from "@/config/global";
import { Logger, WalletManager, walletOperation } from "@/common/utils";

import Sidebar from "@/common/components/Sidebar.vue";
import Header from "@/common/components/Header.vue";
import MobileMenu from "@/common/components/menus/MobileMenu.vue";
import LeaseDialog from "@/common/components/modals/LeaseDialog.vue";
import SendReceiveDialog from "@/common/components/modals/SendReceiveDialog.vue";
import SupplyWithdrawDialog from "@/common/components/modals/SupplyWithdrawDialog.vue";
import DelegateUndelegateDialog from "@/common/components/modals/DelegateUndelegateDialog.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";
import SessionExpireDialog from "@/common/components/modals/SessionExpireDialog.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";
import SwapDialog from "@/common/components/modals/SwapDialog.vue";
import { router } from "@/router";

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;
let sessionTimeOut: NodeJS.Timeout | undefined;

const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();

const showErrorDialog = ref(false);
const errorMessage = ref("");
const modalAction = ref<string>("");
const showModal = ref(false);

const modalOptions: {
  [key: string]: {
    route: string;
    dialog: Component;
  };
} = {
  "/lease#create": {
    dialog: LeaseDialog,
    route: "create"
  },
  "/#receive": {
    dialog: SendReceiveDialog,
    route: "receive"
  },
  "/#send": {
    dialog: SendReceiveDialog,
    route: "send"
  },
  "/earn#supply": {
    dialog: SupplyWithdrawDialog,
    route: "supply"
  },
  "/earn#withdraw": {
    dialog: SupplyWithdrawDialog,
    route: "withdraw"
  },
  "/earn#delegate": {
    dialog: DelegateUndelegateDialog,
    route: "delegate"
  },
  "/earn#undelegate": {
    dialog: DelegateUndelegateDialog,
    route: "undelegate"
  },
  "#swap": {
    dialog: SwapDialog,
    route: "swap"
  }
};

provide("openDialog", openDialog);

onMounted(async () => {
  walletOperation(() => {});
  window.addEventListener("keplr_keystorechange", updateKeplr);
  window.addEventListener("leap_keystorechange", updateLeap);
  window.addEventListener("focus", stopTimer);
  window.addEventListener("blur", startTimer);
  openDialog();
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  clearInterval(sessionTimeOut);
  window.removeEventListener("keplr_keystorechange", updateKeplr);
  window.addEventListener("leap_keystorechange", updateLeap);
  window.removeEventListener("focus", stopTimer);
  window.removeEventListener("blur", startTimer);
});

async function connect() {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
  await loadNetwork();
}

async function updateKeplr() {
  try {
    await wallet.CONNECT_KEPLR();
    await loadNetwork();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function updateLeap() {
  try {
    await wallet.CONNECT_LEAP();
    await loadNetwork();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function loadNetwork() {
  try {
    await Promise.all([wallet.LOAD_APR(), app.LOAD_APR_REWARDS(), checkBalances(), checkPrices()]);
  } catch (error: Error | any) {
    Logger.error(error);
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function checkBalances() {
  balanceInterval = setInterval(async () => {
    try {
      if (WalletManager.getWalletAddress() !== "") {
        await wallet.UPDATE_BALANCES();
      }
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_BALANCE_INTERVAL);
}

async function checkPrices() {
  pricesInterval = setInterval(async () => {
    try {
      await oracle.GET_PRICES();
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_PRICES_INTERVAL);
}

function startTimer() {
  if (sessionTimeOut) {
    clearInterval(sessionTimeOut);
  }
  sessionTimeOut = setTimeout(() => {
    app.sessionExpired = true;
    clearInterval(balanceInterval);
    clearInterval(pricesInterval);
  }, SESSION_TIME);
}

function stopTimer() {
  if (sessionTimeOut) {
    clearInterval(sessionTimeOut);
  }
}

function refresh() {
  window.location.reload();
}

function openDialog() {
  if (window.location.hash) {
    let action = `${window.location.pathname}${window.location.hash}`;
    let modal = modalOptions[action];
    console.log(modal, action);
    if (!modal) {
      action = window.location.hash;
      modal = modalOptions[action];
    }

    if (modal) {
      modalAction.value = action;
      showModal.value = true;
    }

    if (modal == undefined) {
      router.push(router.currentRoute.value.path);
    }
  }
}
</script>

<style lang="scss" scoped>
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

@media (min-width: 1180px) {
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
