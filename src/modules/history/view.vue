<template>
  <div class="flex flex-col gap-8">
    <div class="flex justify-between">
      <ListHeader :title="$t('message.realized-pnl')" />
      <Button
        :label="$t('message.view-breakdown')"
        severity="secondary"
        size="large"
        @click="router.push(`/${RouteNames.LEASES}/pnl-log`)"
      />
    </div>
    <RealisedPnl />
    <ListHeader :title="$t('message.activities')" />
    <Widget class="overflow-x-auto md:overflow-auto">
      <Table
        searchable
        @input="(e: Event) => (search = (e.target as HTMLInputElement).value)"
        :size="isMobile() ? '' : `${transactions.length} transactions`"
        :columns="transactions.length > 0 ? columns : []"
        tableWrapperClasses="md:min-w-auto md:pr-0"
        @onSearchClear="search = ''"
        tableClasses="min-w-[1060px]"
      >
        <Filter @onFilter="onFilter" />
        <template v-slot:body>
          <template v-if="transactions.length > 0 || historyStore.hasPendingTransfers">
            <HistoryTableRowWrapper
              v-for="transaction of txsSkip"
              :transaction="transaction as any"
              :key="`${transaction.id}`"
            />
            <HistoryTableRowWrapper
              :transaction="transaction"
              v-for="transaction of txs"
              :key="`${transaction.tx_hash}_${transaction.index}`"
            />
          </template>
          <template v-if="!wallet.wallet || (loaded && transactions.length == 0)">
            <EmptyState
              :slider="[
                {
                  image: { name: 'no-entries' },
                  title: $t('message.no-entries'),
                  description: $t('message.empty-history')
                }
              ]"
            />
          </template>
        </template>
      </Table>
    </Widget>
    <div class="my-4 flex justify-center">
      <Button
        v-if="!loaded && wallet.wallet"
        :label="$t('message.load-more')"
        :loading="loading"
        class="mx-auto"
        severity="secondary"
        size="medium"
        @click="loadMoreTransactions()"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Button, Table, type TableColumnProps, Widget } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import { useHistoryStore } from "@/common/stores/history";
import { isMobile } from "@/common/utils";
import { RouteNames } from "@/router";
import RealisedPnl from "./components/RealisedPnl.vue";
import Filter from "./components/Filter.vue";
import HistoryTableRowWrapper from "./components/HistoryTableRowWrapper.vue";
import ListHeader from "@/common/components/ListHeader.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import type { IObjectKeys } from "@/common/types";
import { useRouter } from "vue-router";
import { useConfigStore } from "@/common/stores/config";
import type { TransactionFilters } from "@/common/api/types";

const i18n = useI18n();
const wallet = useWalletStore();
const historyStore = useHistoryStore();
const search = ref("");
const router = useRouter();
const configStore = useConfigStore();
const filters = ref<TransactionFilters>({});

// Pagination
const limit = 50;
let skip = 0;

// Use store's state
const transactions = computed(() => historyStore.transactions);
const loading = computed(() => historyStore.transactionsLoading);
const loaded = computed(() => historyStore.allTransactionsLoaded);

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.category"), class: "max-w-[100px]", variant: "left" },
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.time"), class: "max-w-[180px]" },
  { label: i18n.t("message.status"), class: "max-w-[150px]" },
  { label: i18n.t("message.action"), class: "max-w-[120px]" }
]);

// Filtered transactions based on search
const txs = computed(() => {
  const param = search.value.toLowerCase();
  return transactions.value.filter((item) => {
    if (param.length === 0) {
      return true;
    }

    if (
      item.to?.toLowerCase().includes(param) ||
      item.from?.toLowerCase().includes(param) ||
      item.tx_hash?.toLowerCase().includes(param)
    ) {
      return true;
    }

    return false;
  });
});

// Filtered pending transfers based on search
const txsSkip = computed(() => {
  const param = search.value.toLowerCase();
  return historyStore.pendingTransfersList.filter((item) => {
    if (param.length === 0) {
      return true;
    }

    if (
      item.historyData.receiverAddress?.toLowerCase().includes(param) ||
      item.historyData.fromAddress?.toLowerCase().includes(param)
    ) {
      return true;
    }

    return false;
  });
});

// Initialize when config is ready
watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized) {
      initializeHistory();
    }
  },
  { immediate: true }
);

// Reset and reload when wallet changes
watch(
  () => wallet.wallet,
  () => {
    skip = 0;
    historyStore.resetTransactions();
    
    if (wallet.wallet?.address) {
      historyStore.setAddress(wallet.wallet.address);
      loadTransactions(true);
    }
  }
);

async function initializeHistory(): Promise<void> {
  if (wallet.wallet?.address) {
    historyStore.setAddress(wallet.wallet.address);
    await loadTransactions(true);
  }
}

async function loadTransactions(refresh = false): Promise<void> {
  if (!wallet.wallet?.address) {
    return;
  }

  try {
    if (refresh) {
      skip = 0;
      historyStore.resetTransactions();
    }

    const res = await historyStore.fetchTransactions(skip, limit, filters.value, refresh);
    skip += res.length;
  } catch (e) {
    console.error("[HistoryView] Failed to load transactions:", e);
  }
}

async function loadMoreTransactions(): Promise<void> {
  await loadTransactions(false);
}

function onFilter(f: IObjectKeys): void {
  skip = 0;
  filters.value = f as TransactionFilters;
  loadTransactions(true);
}
</script>
