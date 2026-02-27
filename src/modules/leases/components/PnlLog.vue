<template>
  <div class="flex flex-1 flex-col justify-between gap-y-2 pb-3 lg:flex-row lg:gap-0">
    <div class="flex items-center">
      <SvgIcon
        name="arrow-left"
        size="l"
        class="mx-4 cursor-pointer text-icon-default"
        @click="goBack"
      />
      <div class="flex flex-col">
        <div class="text-24 font-semibold text-typography-default">{{ $t("message.pnl-history") }}</div>
      </div>
    </div>
  </div>
  <Widget class="overflow-auto">
    <template v-if="walletConnected && !emptyState">
      <div class="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <BigNumber
          :label="$t('message.realized-pnl')"
          :amount="{
            value: pnl.toString(2),
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 24,
            compact: mobile
          }"
        />
        <Button
          :label="$t('message.download-csv')"
          severity="secondary"
          size="large"
          :loading="loadingPnl"
          @click="downloadCsv()"
        />
      </div>
      <!-- <PositionPreviewChart /> -->
      <Table
        :columns="leasesHistory.length > 0 ? columns : []"
        :table-classes="mobile ? '' : 'min-w-[660px]'"
        :scrollable="!mobile"
      >
        <template v-slot:body>
          <TableRow
            v-for="(row, index) in leasesHistory"
            :key="index"
            :items="row.items"
            :scrollable="!mobile"
          />
        </template>
      </Table>
    </template>
    <template v-else>
      <EmptyState
        :slider="[
          {
            image: { name: 'new-lease' },
            title: $t('message.start-lease'),
            description: $t('message.start-lease-description'),
            link: {
              label: $t('message.learn-new-leases'),
              onClick: () => IntercomService.askQuestion('How does margin leverage work?')
            }
          }
        ]"
      />
    </template>
  </Widget>
  <div class="my-4 flex justify-center">
    <Button
      v-if="!loaded"
      :label="$t('message.load-more')"
      :loading="loading"
      class="mx-auto"
      severity="secondary"
      size="medium"
      @click="loadMore"
    />
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import {
  Label,
  type LabelProps,
  Table,
  type TableColumnProps,
  TableRow,
  type TableRowItemProps,
  Widget,
  SvgIcon,
  Button
} from "web-components";
import { computed, h, ref, watch } from "vue";
import BigNumber from "@/common/components/BigNumber.vue";
import type { IObjectKeys } from "@/common/types";
import { NATIVE_CURRENCY } from "@/config/global";
import type { ILoan } from "./types";
import { getCreatedAtForHuman, IntercomService, isMobile, Logger } from "@/common/utils";
import { formatUsd } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTickerForProtocol, getLpnByProtocol, getProtocolByContract } from "@/common/utils/CurrencyLookup";
import { useAnalyticsStore } from "@/common/stores";
import { Dec } from "@keplr-wallet/unit";
import { RouteNames } from "@/router";
import { useRouter } from "vue-router";
import EmptyState from "@/common/components/EmptyState.vue";
import { useConfigStore } from "@/common/stores/config";
import { useWalletConnected } from "@/common/composables";
import { useConnectionStore } from "@/common/stores/connection";

const mobile = isMobile();
const i18n = useI18n();
const analyticsStore = useAnalyticsStore();
const configStore = useConfigStore();
const connectionStore = useConnectionStore();
const walletConnected = useWalletConnected();
const router = useRouter();

// Realized PnL from analytics store
const pnl = computed(() => {
  const realized = analyticsStore.realizedPnl?.realized_pnl;
  return realized ? new Dec(realized) : new Dec(0);
});

const limit = 10;
let skip = 0;
const loadingPnl = ref(false);

const loading = computed(() => analyticsStore.realizedPnlListLoading);
const loaded = ref(false);

const loans = ref([] as ILoan[]);

const emptyState = computed(() => {
  return !loading.value && loans.value.length === 0;
});

const columns = computed<TableColumnProps[]>(() =>
  mobile
    ? [{ label: i18n.t("message.asset"), variant: "left" }, { label: i18n.t("message.realized") }]
    : [
        { label: i18n.t("message.contract-id"), variant: "left", class: "max-w-[120px]" },
        { label: i18n.t("message.type"), variant: "left", class: "max-w-[200px]" },
        { label: i18n.t("message.asset"), variant: "left" },
        { label: i18n.t("message.action") },
        { label: i18n.t("message.realized") },
        { label: i18n.t("message.date-capitalize"), class: "max-w-[200px] w-full" }
      ]
);

const filename = "data.csv";
const delimiter = ",";

// Watch wallet address (from connectionStore) + config initialization.
// This follows the same pattern as DashboardLeases: the store self-loads
// via connectionStore.walletAddress watcher, and the component triggers
// paginated fetches when both dependencies are ready.
watch(
  [() => connectionStore.walletAddress, () => configStore.initialized],
  ([address, initialized], [oldAddress]) => {
    if (!initialized) return;

    if (address && address !== oldAddress) {
      skip = 0;
      loans.value = [];
      loaded.value = false;
      loadMore();
    }
  },
  { immediate: true }
);

function goBack() {
  router.push({ path: `/${RouteNames.HISTORY}` });
}

async function loadMore() {
  try {
    if (!connectionStore.walletAddress || !configStore.initialized) return;

    const res = await analyticsStore.fetchPnlList(skip, limit);
    loans.value = [...loans.value, ...res] as ILoan[];
    if (res.length < limit) {
      loaded.value = true;
    }
    skip += limit;
  } catch (e: unknown) {
    Logger.error(e);
  }
}

const leasesHistory = computed(() => {
  return loans.value
    .filter((item) => configStore.getProtocolByContract(item.LS_loan_pool_id))
    .map((item) => {
      const protocol = getProtocolByContract(item.LS_loan_pool_id);
      const ticker = item.LS_asset_symbol;
      const positionType = configStore.getPositionType(protocol);
      const currency =
        positionType === "Short" ? getLpnByProtocol(protocol) : getCurrencyByTickerForProtocol(ticker, protocol);

      const pnl = new Dec(item.LS_pnl, currency.decimal_digits);
      const pnl_amount = formatUsd(pnl.toString(2));
      const pnl_status = pnl.isZero() || pnl.isPositive();

      const raw = item.LS_timestamp;
      const date = new Date(raw);
      const typeLabel = positionType === "Short" ? i18n.t("message.short") : i18n.t("message.long");

      if (mobile) {
        return {
          items: [
            {
              image: currency.icon,
              value: currency.shortName,
              subValue: typeLabel,
              subValueClass: positionType === "Short" ? "text-typography-error" : "text-typography-success",
              variant: "left"
            },
            {
              value: pnl_amount,
              class: `${pnl_status ? "text-typography-success" : "text-typography-error"}`
            }
          ]
        };
      }

      return {
        items: [
          {
            value: `#${item.LS_contract_id.slice(-8)}`,
            class: "text-typography-link cursor-pointer max-w-[120px]",
            variant: "left"
          },
          {
            component: getType(item),
            class: "max-w-[200px] cursor-pointer",
            variant: "left"
          },
          {
            image: currency.icon,
            value: currency.shortName,
            subValue: currency.name,
            variant: "left"
          },
          {
            value: i18n.t(`message.status-${item.LS_Close_Strategy ?? item.Type}`)
          },
          {
            value: pnl_amount,
            class: `${pnl_status ? "text-typography-success" : "text-typography-error"}`
          },
          {
            value: getCreatedAtForHuman(date) as string,
            class: "max-w-[200px]"
          }
        ]
      };
    }) as TableRowItemProps[];
});

function getType(item: ILoan) {
  const protocol = getProtocolByContract(item.LS_loan_pool_id);
  const positionType = configStore.getPositionType(protocol);

  if (positionType === "Short") {
    return () => h<LabelProps>(Label, { value: i18n.t("message.short"), variant: "error" });
  } else {
    return () => h<LabelProps>(Label, { value: i18n.t("message.long"), variant: "success" });
  }
}

function jsonToCsv(rows: IObjectKeys[]) {
  const esc = (v: string) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);

  const lines = [];
  lines.push(cols.map(esc).join(delimiter));

  for (const r of rows) {
    lines.push(cols.map((c) => esc(r[c])).join(delimiter));
  }
  return lines.join("\r\n");
}

async function downloadCsv() {
  if (!connectionStore.walletAddress) {
    return;
  }

  loadingPnl.value = true;

  // Use analyticsStore to fetch realized PnL data
  await analyticsStore.fetchRealizedPnlData();
  const data = analyticsStore.realizedPnlData ?? [];
  const csv = "\uFEFF" + jsonToCsv(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  loadingPnl.value = false;
}
</script>

<style scoped lang=""></style>
