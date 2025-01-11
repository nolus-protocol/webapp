<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.history')" />
    <Widget class="overflow-x-auto md:overflow-auto">
      <Table
        searchable
        @input="(e: Event) => (search = (e.target as HTMLInputElement).value)"
        :size="`${transactions.length} transactions`"
        :columns="transactions.length > 0 ? columns : []"
        :class="[{ 'min-w-[600px]': transactions.length > 0 }]"
        @onSearchClear="search = ''"
      >
        <template v-slot:body>
          <template v-if="transactions.length > 0 || Object.keys(wallet.history).length > 0">
            <WalletHistoryTableRowWrapper />
            <HistoryTableRowWrapper
              :transaction="transaction"
              v-for="transaction of txs"
              :key="`${transaction.tx_hash}_${transaction.index}`"
            />
          </template>
          <template v-if="!wallet.wallet || (loaded && transactions.length == 0)">
            <EmptyState
              :image="{ name: 'no-entries' }"
              :title="$t('message.no-entries')"
              :description="$t('message.empty-history')"
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
        @click="loadTxs"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Table, type TableColumnProps, Widget, Button } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import { EtlApi } from "@/common/utils";
import { type ITransactionData } from "@/modules/history/types";

import HistoryTableRowWrapper from "./components/HistoryTableRowWrapper.vue";
import ListHeader from "@/common/components/ListHeader.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import WalletHistoryTableRowWrapper from "@/modules/history/components/WalletHistoryTableRowWrapper.vue";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransactionData[]);
const i18n = useI18n();
const wallet = useWalletStore();
const search = ref("");

const columns: TableColumnProps[] = [
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.category"), class: "max-w-[140px]" },
  { label: i18n.t("message.time"), class: "max-w-[180px]" },
  { label: i18n.t("message.status"), class: "max-w-[150px]" },
  { label: i18n.t("message.action"), class: "max-w-[120px]" }
];

const limit = 10;
let skip = 0;

const loading = ref(false);
const loaded = ref(false);
const showSkeleton = ref(true);

const txs = computed(() => {
  const param = search.value.toLowerCase();
  return transactions.value.filter((item) => {
    if (param.length == 0) {
      return true;
    }

    if (
      item.to.toLowerCase().includes(param) ||
      item.from.toLowerCase().includes(param) ||
      item.tx_hash.toLowerCase().includes(param)
    ) {
      return true;
    }

    return false;
  });
});

onMounted(() => {
  loadTxs();
});

watch(
  () => wallet.wallet,
  () => {
    skip = 0;
    loadTxs();
  }
);

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
</script>
