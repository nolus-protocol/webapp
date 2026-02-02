<template>
  <ListHeader :title="$t('message.leases')">
    <Button
      v-if="wallet.wallet && !isProtocolDisabled"
      :label="$t('message.new-lease')"
      severity="primary"
      size="large"
      @click="router.push({ path: `/${RouteNames.LEASES}/open/long` })"
    />
  </ListHeader>
  <Widget
    class="overflow-auto"
    v-if="leaseLoaded"
  >
    <EmptyState
      v-if="leases.length == 0"
      :slider="[
        {
          image: { name: 'new-lease' },
          title: $t('message.start-lease'),
          description: $t('message.start-lease-description'),
          link: {
            label: $t('message.learn-new-leases'),
            url: `/${RouteNames.LEASES}/learn-leases`,
            tooltip: { content: $t('message.learn-new-leases') }
          }
        }
      ]"
    />
    <template v-else>
      <Table
        searchable
        :size="isTablet() ? '' : `${leasesData.length} ${$t('message.leases-table-label')}`"
        :columns="leasesData.length > 0 ? columns : []"
        tableWrapperClasses="md:min-w-auto md:p-0"
        tableClasses="min-w-[1000px]"
        :hide-values="isTablet() ? undefined : { text: $t('message.toggle-values'), value: hide }"
        @hide-value="onHide"
        @onSearchClear="onSearch('')"
        @on-input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
      >
        <div class="flex flex-col gap-8 md:flex-row">
          <BigNumber
            :label="$t('message.unrealized-pnl')"
            :amount="{
              hide: hide,
              amount: pnl.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              fontSize: isMobile() ? 20 : 32,
              animatedReveal: true,
              class:
                pnl_percent.isPositive() || pnl_percent.isZero() ? 'text-typography-success' : 'text-typography-error'
            }"
            :pnl-status="{
              positive: pnl_percent.isPositive() || pnl_percent.isZero(),
              value: `${pnl_percent.isPositive() || pnl_percent.isZero() ? '+' : '-'}${pnl_percent.abs().toString(2)}%`,
              badge: {
                content: pnl_percent.toString(),
                base: false
              }
            }"
          />
          <BigNumber
            :label="$t('message.leases-table')"
            :amount="{
              amount: activeLeases.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 20,
              animatedReveal: true,
              hide: hide
            }"
          />
          <BigNumber
            :label="$t('message.debt')"
            :amount="{
              amount: debt.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 20,
              animatedReveal: true,
              hide: hide
            }"
          />
        </div>
        <template v-slot:body>
          <TableRow
            v-for="(row, index) in leasesData"
            :key="index"
            :items="row.items"
          />
        </template>
      </Table>
    </template>
  </Widget>
  <SharePnLDialog ref="sharePnlDialog" />
  <router-view />
</template>

<script lang="ts" setup>
import {
  Button,
  type ButtonProps,
  Table,
  type TableColumnProps,
  TableRow,
  type TableRowItemProps,
  Widget
} from "web-components";

import { RouteNames } from "@/router";

import BigNumber, { type IBigNumber } from "@/common/components/BigNumber.vue";
import ListHeader from "@/common/components/ListHeader.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import SharePnLDialog from "@/modules/leases/components/single-lease/SharePnLDialog.vue";

import { useI18n } from "vue-i18n";
import { type Component, computed, h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { isMobile, isTablet, Logger, WalletManager } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker, getCurrencyByDenom } from "@/common/utils/CurrencyLookup";

import { Dec } from "@keplr-wallet/unit";
import { IntercomService } from "@/common/utils/IntercomService";
import { useWalletStore } from "@/common/stores/wallet";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useApplicationStore } from "@/common/stores/application";
import {
  Contracts,
  MAX_DECIMALS,
  MID_DECIMALS,
  NATIVE_CURRENCY,
  PositionTypes,
  ProtocolsConfig,
  UPDATE_LEASES
} from "@/config/global";
import { useRouter } from "vue-router";
import type { IAction } from "./single-lease/Action.vue";
import Action from "./single-lease/Action.vue";
import TableNumber from "@/common/components/TableNumber.vue";
import type { LeaseInfo } from "@/common/api";

const leasesStore = useLeasesStore();
const leaseLoaded = computed(() => !leasesStore.loading || leasesStore.leases.length > 0);
const leases = computed(() => leasesStore.leases);
const activeLeases = ref(new Dec(0));
const pnl = ref(new Dec(0));
const debt = ref(new Dec(0));
const pnl_percent = ref(new Dec(0));
const router = useRouter();
const wallet = useWalletStore();
const app = useApplicationStore();
const i18n = useI18n();
const hide = ref(WalletManager.getHideBalances());
const search = ref("");
const sharePnlDialog = ref<typeof SharePnLDialog | null>(null);
let openMenuId: string | null;

let timeOut: NodeJS.Timeout;

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.lease"), variant: "left", class: "max-w-[150px]" },
  { label: i18n.t("message.asset"), variant: "left" },
  { label: i18n.t("message.type"), variant: "left", class: "max-w-[45px]" },
  { label: i18n.t("message.pnl"), class: "max-w-[200px]" },
  { label: i18n.t("message.lease-size") },
  { label: i18n.t("message.liquidation-lease-table"), class: "max-w-[200px]" },
  { label: "", class: "max-w-[220px]" }
]);

const isProtocolDisabled = computed(() => {
  const protocols = Contracts.protocolsFilter[app.protocolFilter];
  return protocols.disabled;
});

const leasesData = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();
  const items = leases.value
    .filter((item) => {
      if (param.length == 0) {
        return true;
      }
      const positionTicker = item.etl_data?.lease_position_ticker ?? item.amount.ticker;
      const c = app.currenciesData?.[`${positionTicker}@${item.protocol}`];
      if (
        item.address.toLowerCase().includes(param) ||
        positionTicker?.toLowerCase().includes(param) ||
        c?.shortName?.toLowerCase()?.includes(param)
      ) {
        return true;
      }

      return false;
    })
    .map((item) => {
      try {
      const displayData = leasesStore.getLeaseDisplayData(item);
      const pnlData = {
        percent: displayData.pnlPercent.toString(2),
        amount: CurrencyUtils.formatPrice(displayData.pnlAmount.toString()),
        status: displayData.pnlPositive
      };
      const loading = isLeaseInProgress(item);
      const liquidation = loading
        ? { component: () => h("div", { class: "skeleton-box mb-2 rounded-[4px] w-[70px] h-[20px]" }) }
        : {
            value: formatNumber(displayData.liquidationPrice.toString(), MID_DECIMALS, NATIVE_CURRENCY.symbol),
            class: "max-w-[200px]"
          };

      const asset = getAsset(item);
      const amount = displayData.unitAsset;
      const stable = displayData.assetValueUsd;
      const actions: Component[] = getActions(item, displayData);
      const value = {
        subValue: `${NATIVE_CURRENCY.symbol}${stable.toString(MAX_DECIMALS)}`,
        value: `${amount.toString(MAX_DECIMALS)}`,
        tooltip: `${amount.toString(asset?.decimal_digits ?? 6)}`
      };

      if (hide.value) {
        value.value = "****";
        value.subValue = "****";
      }

      return {
        items: [
          {
            value: getTitle(item),
            subValueClass: "text-typography-secondary rounded border-[1px] px-2 py-1 self-start",
            variant: "left",
            click: () => {
              router.push(`/${RouteNames.LEASES}/${item.protocol.toLocaleLowerCase()}/${item.address}`);
            },
            class: "text-typography-link font-semibold max-w-[150px] cursor-pointer"
          },
          {
            image: getAssetIcon(item),
            imageClass: "w-[32px] h-[32px]",
            value: asset?.shortName ?? "",
            subValue: asset?.name ?? "",
            variant: "left",
            textClass: "line-clamp-1 [display:-webkit-box]"
          },
          {
            value: `${i18n.t(`message.${ProtocolsConfig[item.protocol]?.type ?? "long"}`)}`,
            variant: "left",
            class: "max-w-[45px]"
          },
          {
            component: () =>
              loading
                ? h("div", { class: "skeleton-box mb-2 rounded-[4px] w-[70px] h-[20px]" })
                : h<IBigNumber>(BigNumber, {
                    pnlStatus: {
                      positive: pnlData.status,
                      value: `${pnlData.status ? "+" : ""}${pnlData.percent}% (${hide.value ? "****" : pnlData.amount})`,
                      badge: {
                        content: pnlData.percent,
                        base: false
                      }
                    }
                  }),
            class: "max-w-[200px]"
          },
          {
            component: () =>
              loading
                ? h("div", { class: "skeleton-box mb-2 rounded-[4px] w-[70px] h-[20px]" })
                : h(TableNumber, {
                    value: value.value,
                    subValue: value.subValue,
                    tooltip: value.tooltip
                  }),
            class: "font-semibold break-all"
          },
          liquidation,
          {
            component: () => [...actions],
            class: "max-w-[220px] pr-4 cursor-pointer"
          }
        ]
      };
      } catch (e) {
        Logger.error("[Leases] Error processing lease:", item.address, e);
        return null;
      }
    }).filter((item): item is TableRowItemProps => item !== null);
  return items;
});

onMounted(async () => {
  // Initialize leases store with wallet address
  if (wallet.wallet?.address) {
    await leasesStore.setOwner(wallet.wallet.address);
  }
  
  timeOut = setInterval(() => {
    leasesStore.refresh();
  }, UPDATE_LEASES);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

function reload() {
  leasesStore.refresh();
}

function getTitle(item: LeaseInfo) {
  if (item.status === "opening") {
    return `${i18n.t("message.opening")}...`;
  }

  if (item.status === "opened") {
    if (item.in_progress && "close" in item.in_progress) {
      return `${i18n.t("message.closing")}...`;
    }

    if (item.in_progress && "repayment" in item.in_progress) {
      return `${i18n.t("message.repaying")}...`;
    }
  }

  if (item.status === "paid_off") {
    if (item.in_progress && "transfer_in" in item.in_progress) {
      return `${i18n.t("message.collecting")}...`;
    }
  }

  return `#${item.address.slice(-8)}`;
}

function getAssetIcon(item: LeaseInfo) {
  const positionTicker = item.etl_data?.lease_position_ticker ?? item.amount.ticker;
  
  switch (ProtocolsConfig[item.protocol]?.type) {
    case PositionTypes.long: {
      if (item.status === "opening" && item.opening_info) {
        return app.assetIcons?.[`${item.opening_info.currency}@${item.protocol}`]!;
      }
      break;
    }
    case PositionTypes.short: {
      if (item.status === "opening" && item.opening_info) {
        return app.assetIcons?.[`${item.opening_info.loan.ticker}@${item.protocol}`]!;
      }
    }
  }
  return app.assetIcons?.[`${positionTicker}@${item.protocol}`] as string;
}

function getAsset(lease: LeaseInfo) {
  try {
    const positionType = ProtocolsConfig[lease.protocol]?.type ?? PositionTypes.long;
    
    switch (positionType) {
      case PositionTypes.long: {
        const ticker = lease.amount.ticker || lease.opening_info?.currency;
        if (!ticker) return null;
        const item = getCurrencyByTicker(ticker as string);
        const asset = getCurrencyByDenom(item?.ibcData as string);
        return asset;
      }
      case PositionTypes.short: {
        const positionTicker = lease.etl_data?.lease_position_ticker ?? lease.amount.ticker;
        if (!positionTicker) return null;
        const item = getCurrencyByTicker(positionTicker as string);
        const asset = getCurrencyByDenom(item?.ibcData as string);
        return asset;
      }
    }
  } catch (e) {
    Logger.error("[Leases] Error getting asset for lease:", lease.address, e);
    return null;
  }
}

function getActions(lease: LeaseInfo, displayData: LeaseDisplayData) {
  const isOpened = lease.status === "opened";
  const actions = [
    h<ButtonProps>(Button, {
      label: i18n.t("message.details"),
      severity: "secondary",
      size: "medium",
      key: `details-${lease.address}`,
      onClick: () => {
        router.push(`/${RouteNames.LEASES}/${lease.protocol?.toLowerCase()}/${lease.address}`);
      }
    }),
    h<IAction>(Action, {
      lease,
      showCollect: false,
      showClose: isOpened,
      key: `action-${lease.address}`,
      opened: openMenuId == lease.address,
      onClick: (data: boolean) => {
        if (data) {
          openMenuId = lease.address;
        } else {
          openMenuId = null;
        }
      },
      onSharePnl: () => {
        sharePnlDialog.value?.show(lease, displayData);
      }
    })
  ];

  if (isOpened && displayData.inProgressType) {
    return [];
  }
  return actions;
}

function isLeaseInProgress(lease: LeaseInfo): boolean {
  if (lease.status === "opening" || lease.status === "closing") {
    return true;
  }
  if (lease.in_progress) {
    return true;
  }
  return false;
}

watch(
  () => leases.value,
  () => {
    setLeases();
  }
);

// Watch for wallet changes to update the store
watch(
  () => wallet.wallet?.address,
  async (newAddress) => {
    if (newAddress) {
      await leasesStore.setOwner(newAddress);
    } else {
      leasesStore.clear();
    }
  }
);

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);

    let am = new Dec(0);
    let dp = new Dec(0);
    let rp = new Dec(0);

    for (const lease of leases.value) {
      const displayData = leasesStore.getLeaseDisplayData(lease);
      
      if (lease.status === "opened") {
        ls = ls.add(displayData.assetValueUsd);
        am = am.add(displayData.pnlAmount);
        dp = dp.add(displayData.downPayment);
        rp = rp.add(displayData.repaymentValue);
      }
      
      db = db.add(displayData.totalDebtUsd);
      pl = pl.add(displayData.pnlAmount);
    }
    
    pnl.value = pl;
    activeLeases.value = ls;
    debt.value = db;

    const amount = dp.add(rp);

    if (!(amount.isZero() || am.isZero())) {
      pnl_percent.value = am.quo(dp.add(rp)).mul(new Dec(100));
    }

    const openedCount = leases.value.filter((l) => l.status === "opened").length;
    IntercomService.updatePositions({
      count: openedCount,
      valueUsd: ls.toString(),
      debtUsd: db.toString(),
      unrealizedPnlUsd: pl.toString()
    });
  } catch (e) {
    Logger.error(e);
  }
}

function onHide(data: boolean) {
  hide.value = data;
  WalletManager.setHideBalances(data);
}

function onSearch(data: string) {
  search.value = data;
}

provide("reload", reload);
</script>
