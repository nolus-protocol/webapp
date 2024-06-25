<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <!-- Header -->
    <div class="table-header mt-[25px] flex flex-wrap items-baseline justify-between px-4 lg:px-0">
      <div class="left">
        <h1 class="nls-font-700 m-0 text-20 text-primary">
          {{ $t("message.history") }}
        </h1>
      </div>
    </div>
    <!-- History -->
    <Table
      :class="{ outline: hasOutline }"
      :columns="columns"
      class="async-loader mt-6"
      columnsClasses="hidden md:flex"
    >
      <template v-slot:body>
        <template v-if="initialLoad && !showSkeleton">
          <TransitionGroup
            appear
            name="fade-long"
          >
            <div
              v-for="tx of history"
              :key="tx.key"
            >
              <HistoryTableLoadingRow
                :action="tx.action"
                :fee="tx.fee.toString()"
                :status="tx.status"
                :button="$t('message.details')"
                @button-click="openAction(tx.key)"
              >
                <template v-slot:status>
                  <span
                    v-if="tx.step == CONFIRM_STEP.SUCCESS"
                    class="icon icon-arrow-down-sort mr-2 !text-[12px] text-success-100"
                  >
                  </span>
                  <Spinner
                    v-if="tx.step == CONFIRM_STEP.PENDING"
                    class="mr-2"
                  />
                  <span
                    v-if="tx.step == CONFIRM_STEP.ERROR"
                    class="icon icon-close !text-[20px] text-danger-100"
                  >
                  </span>
                </template>
              </HistoryTableLoadingRow>
            </div>
            <div
              v-for="(transaction, index) of transactions"
              :key="`${transaction.id}_${index}`"
            >
              <HistoryTableRowWrapper :transaction="transaction" />
            </div>
            <div
              v-if="transactions.length == 0 && Object.keys(wallet.history).length == 0"
              class="h-[180px]"
            >
              <div class="nls-12 text-dark-grey flex h-full flex-col items-center justify-center">
                <img
                  class="m-4 inline-block"
                  height="32"
                  src="/src/assets/icons/empty_history.svg"
                  width="32"
                />
                {{ $t("message.no-results") }}
              </div>
            </div>
          </TransitionGroup>
        </template>
        <template v-else>
          <HistoryTableSkeleton />
        </template>
      </template>
    </Table>
    <div class="my-4 flex justify-center">
      <Button
        v-if="visible"
        :label="$t('message.load-more')"
        :loading="loading"
        class="mx-auto"
        severity="secondary"
        size="medium"
        @click="load"
      />
    </div>
  </div>
  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
  <Modal
    v-if="state.showModal"
    :route="state.modalAction"
    @close-modal="state.showModal = false"
  >
    <component
      :is="modalOptions[state.modalAction]"
      :data="state.data"
      :route="state.modalAction"
    />
  </Modal>
</template>

<script lang="ts" setup>
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { HYSTORY_ACTIONS, type ITransaction } from "./types";
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import { AssetUtils, NetworkUtils } from "@/common/utils";
import { Button, HistoryTableLoadingRow, Table, Spinner } from "web-components";
import { useI18n } from "vue-i18n";

import HistoryTableRowWrapper from "@/modules/history/components/HistoryTableRowWrapper.vue";
import HistoryTableSkeleton from "@/modules/history/components/HistoryTableSkeleton.vue";
import { useWalletStore } from "@/common/stores/wallet";
import type { Coin } from "@keplr-wallet/types";
import { CurrencyUtils } from "@nolus/nolusjs";
import { CONFIRM_STEP, type IObjectKeys } from "@/common/types";
import type { EvmNetwork, Network } from "@/common/types/Network";
import type { CoinPretty } from "@keplr-wallet/unit";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransaction[]);
const i18n = useI18n();
const wallet = useWalletStore();

const columns = [
  { label: i18n.t("message.tx-hash"), class: "max-w-[200px]" },
  { label: i18n.t("message.action"), class: "!justify-start" },
  { label: i18n.t("message.fee"), class: "max-w-[200px]" },
  { label: i18n.t("message.time"), class: "max-w-[200px]" }
];

const senderPerPage = 10;
let senderPage = 1;
let senderTotal = 0;

const loading = ref(false);
const loaded = ref(false);
const initialLoad = ref(false);
const showSkeleton = ref(true);
let timeout: NodeJS.Timeout;
const SendReceiveDialogV2 = defineAsyncComponent(() => import("@/common/components/modals/SendReceiveDialogV2.vue"));
const SwapDialog = defineAsyncComponent(() => import("@/common/components/modals/SwapDialog.vue"));

const modalOptions = {
  [HYSTORY_ACTIONS.SENDV2]: SendReceiveDialogV2,
  [HYSTORY_ACTIONS.RECEIVEV2]: SendReceiveDialogV2,
  [HYSTORY_ACTIONS.SWAP]: SwapDialog
};

const state = ref<{
  showModal: boolean;
  modalAction: HYSTORY_ACTIONS;
  data: IObjectKeys | null;
}>({
  showModal: false,
  modalAction: HYSTORY_ACTIONS.SENDV2,
  data: null
});

onMounted(() => {
  loadTxs();
});

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout);
  }
});

watch(
  () => wallet.wallet,
  () => {
    senderPage = 1;
    senderTotal = 0;
    loadTxs();
  }
);

const hasOutline = computed(() => {
  if (window.innerWidth > 576) {
    return true;
  }
  return transactions.value.length > 0;
});

const visible = computed(() => {
  return initialLoad.value && !loaded.value;
});

function onClickTryAgain() {
  loadTxs();
}

async function getTransactions() {
  try {
    const res = await NetworkUtils.searchTx({
      sender_per_page: senderPerPage,
      sender_page: senderPage
    });

    senderPage++;
    senderTotal = res.sender_total as number;
    transactions.value = res.data as ITransaction[];
    const loadedSender = (senderPage - 1) * senderPerPage >= senderTotal;

    if (loadedSender) {
      loaded.value = true;
    }

    initialLoad.value = true;
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
}

async function load() {
  try {
    loading.value = true;
    const loadSender = (senderPage - 1) * senderPerPage <= senderTotal;

    const res = await NetworkUtils.searchTx({
      sender_per_page: senderPerPage,
      sender_page: senderPage,
      load_sender: loadSender
    });

    transactions.value = [...transactions.value, ...res.data] as ITransaction[];

    if (loadSender) {
      senderPage++;
    }

    const loadedSender = (senderPage - 1) * senderPerPage <= senderTotal;

    if (!loadedSender) {
      loaded.value = true;
    }

    senderTotal = res.sender_total as number;
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  } finally {
    setTimeout(() => {
      loading.value = false;
    }, 200);
  }
}

const history = computed(() => {
  const h = wallet.history;
  const items = [];

  for (const key in h) {
    const item = h[key];
    items.push({
      action: item.action,
      status: i18n.t(`message.${item.step}-History`),
      fee: calculateFee(item.fee, item.selectedNetwork) as CoinPretty,
      step: item.step,
      key
    });
  }
  return items.sort((a, b) => Number(b.key) - Number(a.key));
});

function calculateFee(coin: Coin, network: Network | EvmNetwork) {
  switch (network.chain_type) {
    case "cosmos": {
      return calculateCosmosFee(coin, network);
    }
    case "evm": {
      return calculateEvmFee(coin, network);
    }
  }
}

function calculateCosmosFee(coin: Coin, _network: Network | EvmNetwork) {
  const asset = AssetUtils.getCurrencyByDenom(coin.denom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    asset.ibcData,
    asset.shortName,
    asset.decimal_digits
  );
}

function calculateEvmFee(coin: Coin, network: Network | EvmNetwork) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    coin.denom,
    coin.denom,
    (network as EvmNetwork).nativeCurrency.decimals
  );
}

function loadTxs() {
  getTransactions();
  timeout = setTimeout(() => {
    showSkeleton.value = false;
  }, 400);
}

function openAction(key: string | number) {
  state.value.data = wallet.history[key];
  state.value.showModal = true;
  state.value.modalAction = wallet.history[key].action;
}

watch(
  () => wallet.history,
  () => {
    if (state.value.data) {
      state.value.data = wallet.history[state.value.data.id];
    }
  },
  {
    deep: true
  }
);
</script>
