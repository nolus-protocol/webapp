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
              v-for="(transaction, index) of transactions"
              :key="`${transaction.id}_${index}`"
            >
              <HistoryTableRowWrapper :transaction="transaction" />
              <div
                v-if="transactions.length == 0"
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
</template>

<script lang="ts" setup>
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { type ITransaction } from "./types";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { NetworkUtils } from "@/common/utils";
import { Button, Table } from "web-components";
import HistoryTableRowWrapper from "@/modules/history/components/HistoryTableRowWrapper.vue";
import HistoryTableSkeleton from "@/modules/history/components/HistoryTableSkeleton.vue";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransaction[]);
const columns = [
  { label: "Tx hash", class: "max-w-[200px]" },
  { label: "Action" },
  { label: "Fee", class: "max-w-[200px]" },
  { label: "Time", class: "max-w-[200px]" }
];

const senderPerPage = 10;
let senderPage = 1;
let senderTotal = 0;

const loading = ref(false);
const loaded = ref(false);
const initialLoad = ref(false);
const showSkeleton = ref(true);
let timeout: NodeJS.Timeout;

onMounted(() => {
  loadTxs();
});

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout);
  }
});

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

function loadTxs() {
  getTransactions();
  timeout = setTimeout(() => {
    showSkeleton.value = false;
  }, 400);
}
</script>
