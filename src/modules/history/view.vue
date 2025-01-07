<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.history')" />
    <Widget class="overflow-x-auto md:overflow-auto">
      <Table
        searchable
        :size="`${transactions.length} transactions`"
        :columns="transactions.length > 0 ? columns : []"
        :class="[{ 'min-w-[600px]': transactions.length > 0 }]"
      >
        <template v-slot:body>
          <template v-if="transactions.length > 0 || Object.keys(wallet.history).length > 0">
            <WalletHistoryTableRowWrapper />
            <HistoryTableRowWrapper
              :transaction="transaction"
              v-for="transaction of transactions"
              :key="`${transaction.tx_hash}_${transaction.index}`"
            />
          </template>
          <!-- <template v-else>
            <EmptyState
              :image="{ name: 'no-entries' }"
              title="No entries"
              description="There are currently no entries."
            />
          </template> -->
        </template>
      </Table>
    </Widget>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Table, type TableColumnProps, Widget } from "web-components";

import { type IObjectKeys } from "@/common/types";

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

const columns: TableColumnProps[] = [
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.category"), class: "max-w-[140px]" },
  { label: i18n.t("message.time"), class: "max-w-[140px]" },
  { label: i18n.t("message.status"), class: "max-w-[150px]" },
  { label: i18n.t("message.action"), class: "max-w-[120px]" }
];

const limit = 10;
let skip = 0;

const loading = ref(false);
const loaded = ref(false);
const showSkeleton = ref(true);
let timeout: NodeJS.Timeout;

const state = ref<{
  data: IObjectKeys | null;
}>({
  data: null
});

onMounted(() => {
  loadTxs();
});

onUnmounted(() => {
  // if (timeout) {
  //   clearTimeout(timeout);
  // }
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

<style scoped lang=""></style>
