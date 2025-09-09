<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.history')" />
    <Widget class="overflow-x-auto md:overflow-auto">
      <Table
        searchable
        @input="(e: Event) => (search = (e.target as HTMLInputElement).value)"
        :size="isMobile() ? '' : `${transactions.length} transactions`"
        :columns="transactions.length > 0 ? columns : []"
        tableClasses="min-w-[660px]"
        tableWrapperClasses="md:min-w-auto md:pr-0"
        @onSearchClear="search = ''"
      >
        <div class="mb-4 flex">
          <div class="flex flex-col gap-2">
            <BigNumber
              :label="$t('message.realized-pnl')"
              :amount="{
                amount: realized_pnl.toString(),
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                fontSize: 20,
                fontSizeSmall: 20,
                hide: hide
              }"
            />
            <Button
              :label="$t('message.view-breakdown')"
              severity="secondary"
              size="small"
              @click="router.push(`/${RouteNames.LEASES}/pnl-log`)"
            />
          </div>
        </div>
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
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Button, Table, type TableColumnProps, Widget } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import { EtlApi, getCreatedAtForHuman, isMobile, WalletManager } from "@/common/utils";
import { type ITransactionData } from "@/modules/history/types";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { NATIVE_CURRENCY } from "@/config/global";
import { RouteNames } from "@/router";
import BigNumber from "@/common/components/BigNumber.vue";

import HistoryTableRowWrapper from "./components/HistoryTableRowWrapper.vue";
import ListHeader from "@/common/components/ListHeader.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import type { HistoryData } from "./types/ITransaction";
import { action, message } from "./common";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";
import type { IObjectKeys } from "@/common/types";
import { useRouter } from "vue-router";
import { Dec } from "@keplr-wallet/unit";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const transactions = ref([] as ITransactionData[] | IObjectKeys[] | any[]);
const i18n = useI18n();
const wallet = useWalletStore();
const search = ref("");
const router = useRouter();
const hide = ref(WalletManager.getHideBalances());
const realized_pnl = ref(new Dec(0));

const voteMessages: { [key: string]: string } = {
  [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.t(`message.abstained`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.t(`message.veto`).toLowerCase(),
  [VoteOption.VOTE_OPTION_YES]: i18n.t(`message.yes`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO]: i18n.t(`message.no`).toLowerCase()
};

const columns: TableColumnProps[] = [
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.category"), class: "max-w-[140px]" },
  { label: i18n.t("message.time"), class: "max-w-[180px]" },
  { label: i18n.t("message.status"), class: "max-w-[150px]" },
  { label: i18n.t("message.action"), class: "max-w-[120px]" }
];

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

onMounted(() => {
  loadTxs();
  getRealizedPnl();
});

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
