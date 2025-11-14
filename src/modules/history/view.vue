<template>
  <div class="flex flex-col gap-8">
    <div class="flex justify-between">
      <ListHeader :title="$t('message.realized-pnl')" />
      <Button
        :label="$t('message.view-breakdown')"
        severity="secondary"
        size="small"
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
        <Filter />
        <template v-slot:body>
          <template v-if="transactions.length > 0 || Object.keys(wallet.history).length > 0">
            <!-- <WalletHistoryTableRowWrapper /> -->
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
        @click="loadTxs"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Button, Table, type TableColumnProps, Widget } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import { EtlApi, getCreatedAtForHuman, isMobile, WalletManager } from "@/common/utils";
import { type ITransactionData } from "@/modules/history/types";
import { RouteNames } from "@/router";
import RealisedPnl from "./components/RealisedPnl.vue";
import Filter from "./components/Filter.vue";

import HistoryTableRowWrapper from "./components/HistoryTableRowWrapper.vue";
import ListHeader from "@/common/components/ListHeader.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import type { HistoryData } from "./types/ITransaction";
import { action, message } from "./common";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";
import type { IObjectKeys } from "@/common/types";
import { useRouter } from "vue-router";
import { Dec } from "@keplr-wallet/unit";
import { useApplicationStore } from "@/common/stores/application";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransactionData[] | IObjectKeys[] | any[]);
const i18n = useI18n();
const wallet = useWalletStore();
const search = ref("");
const router = useRouter();
const app = useApplicationStore();
const hide = ref(WalletManager.getHideBalances());
const realized_pnl = ref(new Dec(0));

const voteMessages: { [key: string]: string } = {
  [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.t(`message.abstained`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.t(`message.veto`).toLowerCase(),
  [VoteOption.VOTE_OPTION_YES]: i18n.t(`message.yes`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO]: i18n.t(`message.no`).toLowerCase()
};

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.category"), class: "max-w-[100px]", variant: "left" },
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.time"), class: "max-w-[180px]" },
  { label: i18n.t("message.status"), class: "max-w-[150px]" },
  { label: i18n.t("message.action"), class: "max-w-[120px]" }
]);

const limit = 50;
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

const txsSkip = computed(() => {
  const param = search.value.toLowerCase();
  return wallet.historyItems.filter((item) => {
    if (param.length == 0) {
      return true;
    }

    if (
      item.historyData.receiverAddress.toLowerCase().includes(param) ||
      item.historyData.fromAddress.toLowerCase().includes(param)
    ) {
      return true;
    }

    return false;
  });
});

watch(
  () => app.init,
  () => {
    if (app.init) {
      onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  loadTxs();
  getRealizedPnl();
}

watch(
  () => wallet.wallet,
  () => {
    skip = 0;
    loadTxs();
    getRealizedPnl();
  }
);

async function loadTxs() {
  try {
    if (wallet.wallet?.address) {
      loading.value = true;
      const res = await EtlApi.fetchTXS(wallet.wallet?.address, skip, limit).then((data) => {
        const promises = [];
        for (const d of data) {
          const fn = async () => {
            const [msg, coin, route, routeDetails] = await message(d, wallet.wallet?.address, i18n, voteMessages);

            d.historyData = {
              msg,
              coin,
              action: action(d, i18n).toLowerCase(),
              timestamp: getCreatedAtForHuman(d.timestamp),
              route,
              routeDetails
            };
            return d;
          };
          promises.push(fn());
        }
        return Promise.all(promises);
      });
      transactions.value = [...transactions.value, ...res] as (ITransactionData & HistoryData)[];
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

async function getRealizedPnl() {
  try {
    const data = await EtlApi.fetchRealizedPNL(wallet?.wallet?.address);
    realized_pnl.value = new Dec(data.realized_pnl);
  } catch (error) {
    console.error(error);
  }
}
</script>
