<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <!-- Header -->
    <div class="table-header mt-[25px] flex flex-wrap items-baseline justify-between px-4 lg:px-0">
      <div class="left">
        <h1 class="m-0 text-20 font-semibold text-neutral-typography-200">
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
        <template v-if="!showSkeleton">
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
                :button="tx.step == CONFIRM_STEP.SUCCESS ? '' : $t('message.details')"
                :fee="tx.fee.toString()"
                :status="tx.status"
                :date="tx.step == CONFIRM_STEP.SUCCESS ? getCreatedAtForHuman(tx.date) : ''"
                @button-click="openAction(tx.key)"
              >
                <template v-slot:status>
                  <span
                    v-if="tx.step == CONFIRM_STEP.SUCCESS"
                    class="icon icon-success !text-[20px] text-success-100"
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
              v-for="transaction of transactions"
              :key="`${transaction.tx_hash}_${transaction.index}`"
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
        @click="loadTxs"
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

import { HYSTORY_ACTIONS, type ITransactionData } from "./types";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { AssetUtils, EtlApi, getCreatedAtForHuman } from "@/common/utils";
import { Button, HistoryTableLoadingRow, Table, Spinner } from "web-components";
import { useI18n } from "vue-i18n";

import HistoryTableRowWrapper from "@/modules/history/components/HistoryTableRowWrapper.vue";
import HistoryTableSkeleton from "@/modules/history/components/HistoryTableSkeleton.vue";
import { useWalletStore } from "@/common/stores/wallet";
import type { Coin } from "@keplr-wallet/types";
import { CurrencyUtils } from "@nolus/nolusjs";
import { CONFIRM_STEP, type IObjectKeys } from "@/common/types";
import type { EvmNetwork, Network } from "@/common/types/Network";
import { Dec, type CoinPretty } from "@keplr-wallet/unit";
import SendReceiveDialogV2 from "@/common/components/modals/SendReceiveDialogV2.vue";
import SwapDialog from "@/common/components/modals/SwapDialog.vue";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransactionData[]);
const i18n = useI18n();
const wallet = useWalletStore();

const columns = [
  { label: i18n.t("message.tx-hash"), class: "max-w-[200px]" },
  { label: i18n.t("message.action"), class: "!justify-start" },
  { label: i18n.t("message.fee"), class: "max-w-[200px]" },
  { label: i18n.t("message.time"), class: "max-w-[200px]" }
];

const limit = 10;
let skip = 0;

const loading = ref(false);
const loaded = ref(false);
const showSkeleton = ref(true);
let timeout: NodeJS.Timeout;

const modalOptions = {
  [HYSTORY_ACTIONS.SEND]: SendReceiveDialogV2,
  [HYSTORY_ACTIONS.RECEIVE]: SendReceiveDialogV2,
  [HYSTORY_ACTIONS.SWAP]: SwapDialog
};

const state = ref<{
  showModal: boolean;
  modalAction: HYSTORY_ACTIONS;
  data: IObjectKeys | null;
}>({
  showModal: false,
  modalAction: HYSTORY_ACTIONS.SEND,
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
    skip = 0;
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
  return !loaded.value;
});

function onClickTryAgain() {
  loadTxs();
}

async function loadTxs() {
  try {
    if (wallet.wallet?.address) {
      loading.value = true;
      const res = await EtlApi.fetchTXS(wallet.wallet?.address, skip, limit);
      transactions.value = [...transactions.value, ...res] as ITransactionData[];
      const loadedSender = res.length < limit;
      if (loadedSender) {
        loaded.value = true;
      }
      skip += limit;
    } else {
      transactions.value = [];
    }
    showSkeleton.value = false;
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
      date: new Date(item.id),
      action: getAction(item),
      status: i18n.t(`message.${item.step}-History`),
      fee: calculateFee(item.fee, item.selectedNetwork) as CoinPretty,
      step: item.step,
      key
    });
  }
  return items.sort((a, b) => Number(b.key) - Number(a.key));
});

function getAction(item: IObjectKeys) {
  switch (item.action) {
    case HYSTORY_ACTIONS.SWAP: {
      return i18n.t("message.swap-skip-action", {
        amount: `${new Dec(item.amount).toString(item.selectedCurrency.decimal_digits)} ${item.selectedCurrency.shortName}`,
        swapTo: `${new Dec(item.swapToAmount).toString(item.swapToSelectedCurrency.decimal_digits)} ${item.swapToSelectedCurrency.shortName}`
      });
    }
    case HYSTORY_ACTIONS.RECEIVE: {
      return i18n.t("message.receive-skip-action", {
        amount: `${new Dec(item.amount).toString(item.selectedCurrency.decimal_digits)} ${item.selectedCurrency.shortName}`,
        network: `${item.selectedNetwork.label}`
      });
    }
    case HYSTORY_ACTIONS.SEND: {
      return i18n.t("message.send-skip-action", {
        amount: `${new Dec(item.amount).toString(item.selectedCurrency.decimal_digits)} ${item.selectedCurrency.shortName}`,
        network: `${item.selectedNetwork.label}`
      });
    }
  }
  return "";
}

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
