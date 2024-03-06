<template>
  <div class="mb-sm-nolus-70p col-span-12">
    <!-- Header -->
    <div class="table-header mt-[25px] flex flex-wrap items-center items-baseline justify-between px-4 lg:px-0">
      <div class="left">
        <h1 class="nls-font-700 m-0 text-20 text-primary">
          {{ $t("message.history") }}
        </h1>
      </div>
    </div>
    <!-- History -->
    <div
      class="background shadow-box async-loader mt-6 block overflow-hidden lg:rounded-xl"
      :class="{ outline: hasOutline }"
    >
      <!-- Assets -->
      <div class="block p-4 lg:p-6">
        <HistoryTableHeader />
        <div
          class="history-items-container block"
          :class="{ 'animate-pulse': !initialLoad }"
        >
          <template v-if="initialLoad && !showSkeleton">
            <TransitionGroup
              name="fade-long"
              appear
            >
              <HistoryTableItem
                v-for="transaction of transactions"
                :key="transaction.id"
                :transaction="transaction"
              />
              <div
                v-if="transactions.length == 0"
                class="h-[180px]"
              >
                <div class="nls-12 text-dark-grey flex h-full flex-col items-center justify-center">
                  <img
                    src="/src/assets/icons/empty_history.svg"
                    class="m-4 inline-block"
                    height="32"
                    width="32"
                  />
                  {{ $t("message.no-results") }}
                </div>
              </div>
            </TransitionGroup>
          </template>
          <template v-else>
            <div
              v-for="index in 10"
              :key="index"
              class="asset-partial nolus-box border-standart relative flex h-[82px] flex-col items-stretch justify-between border-b px-4 py-3 md:h-[53px] md:flex-row md:items-center"
            >
              <div class="flex flex-1 md:flex-[9]">
                <div class="flex max-w-[60%] flex-col justify-between md:flex-row">
                  <div class="h-1.5 w-[9rem] rounded-full bg-grey"></div>
                  <div class="h-1.5 w-[15rem] rounded-full bg-grey md:ml-10"></div>
                </div>
              </div>
              <div class="flex flex-1 items-center justify-between md:flex-[3]">
                <div class="h-1.5 w-24 rounded-full bg-grey md:flex"></div>
                <div class="h-1.5 w-24 rounded-full bg-grey md:flex"></div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="my-4 flex justify-center">
      <button
        v-if="visible"
        class="btn btn-secondary btn-medium-secondary mx-auto"
        :class="{ 'js-loading': loading }"
        @click="load"
      >
        {{ $t("message.load-more") }}
      </button>
    </div>
  </div>
  <Modal
    v-if="showErrorDialog"
    @close-modal="showErrorDialog = false"
    route="alert"
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { type ITransaction } from "./types";
import { onMounted, onUnmounted, ref, computed } from "vue";
import { HistoryTableHeader, HistoryTableItem } from "./components";
import { NetworkUtils } from "@/common/utils";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransaction[]);

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
    }, 500);
  }
}

function loadTxs() {
  getTransactions();
  timeout = setTimeout(() => {
    showSkeleton.value = false;
  }, 400);
}
</script>
