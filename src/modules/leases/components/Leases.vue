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
              fontSizeSmall: isMobile() ? 20 : 32,
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
              fontSizeSmall: 20,
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
              fontSizeSmall: 20,
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
import { CURRENCY_VIEW_TYPES, type LeaseData } from "@/common/types";
import { AssetUtils, isMobile, isTablet, Logger, WalletManager } from "@/common/utils";

import { useLeases } from "@/common/composables";
import { Coin, Dec } from "@keplr-wallet/unit";
import { Intercom } from "@/common/utils/Intercom";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
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
import { getStatus, TEMPLATES } from "./common";
import type { IAction } from "./single-lease/Action.vue";
import Action from "./single-lease/Action.vue";
import type { OpenedOngoingState } from "@nolus/nolusjs/build/contracts/types/OpenedOngoingState";
import TableNumber from "@/common/components/TableNumber.vue";
import type { CloseOngoingState } from "@nolus/nolusjs/build/contracts";

const { leases, getLeases, leaseLoaded } = useLeases((error: Error | any) => {});
const activeLeases = ref(new Dec(0));
const pnl = ref(new Dec(0));
const debt = ref(new Dec(0));
const pnl_percent = ref(new Dec(0));
const router = useRouter();
const wallet = useWalletStore();
const oracle = useOracleStore();
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
      const c = app.currenciesData![`${item.leaseData?.leasePositionTicker}@${item.protocol}`];
      if (
        item.leaseAddress.toLowerCase().includes(param) ||
        item.leaseData?.leasePositionTicker?.toLowerCase().includes(param) ||
        c.shortName?.toLowerCase()?.includes(param)
      ) {
        return true;
      }

      return false;
    })
    .map((item) => {
      const pnl = {
        percent: item.pnlPercent.toString(2),
        amount: CurrencyUtils.formatPrice(item.pnlAmount.toString()),
        status: item.pnlAmount.isPositive() || item.pnlAmount.isZero()
      };
      const loading =
        item.leaseStatus.opening ??
        item.leaseStatus.closing ??
        ((item.leaseStatus.opened?.status as OpenedOngoingState).in_progress as CloseOngoingState)?.close;
      const liquidation = loading
        ? { component: () => h("div", { class: "skeleton-box mb-2 rounded-[4px] w-[70px] h-[20px]" }) }
        : {
            value: AssetUtils.formatNumber(item.liquidation.toString(), MID_DECIMALS, NATIVE_CURRENCY.symbol),
            class: "max-w-[200px]"
          };

      const asset = getAsset(item as LeaseData)!;
      const amount = new Dec(getAmount(item as LeaseData) ?? 0, asset.decimal_digits);
      const stable = getPositionInStable(item as LeaseData);
      const actions: Component[] = getActions(item as LeaseData);
      const value = {
        subValue: `${NATIVE_CURRENCY.symbol}${stable}`,
        value: `${amount.toString(MAX_DECIMALS)}`,
        tooltip: `${amount.toString(asset.decimal_digits)}`
      };

      if (hide.value) {
        value.value = "****";
        value.subValue = "****";
      }

      return {
        items: [
          {
            value: getTitle(item as LeaseData),
            subValueClass: "text-typography-secondary rounded border-[1px] px-2 py-1 self-start",
            variant: "left",
            click: () => {
              router.push(`/${RouteNames.LEASES}/${item.protocol.toLocaleLowerCase()}/${item.leaseAddress}`);
            },
            class: "text-typography-link font-semibold max-w-[150px] cursor-pointer"
          },
          {
            image: getAssetIcon(item as LeaseData),
            imageClass: "w-[32px] h-[32px]",
            value: asset.shortName,
            subValue: asset.name,
            variant: "left",
            textClass: "line-clamp-1 [display:-webkit-box]"
          },
          {
            value: `${i18n.t(`message.${ProtocolsConfig[item.protocol].type}`)}`,
            variant: "left",
            class: "max-w-[45px]"
          },
          {
            component: () =>
              loading
                ? h("div", { class: "skeleton-box mb-2 rounded-[4px] w-[70px] h-[20px]" })
                : h<IBigNumber>(BigNumber, {
                    pnlStatus: {
                      positive: pnl.status,
                      value: `${pnl.status ? "+" : ""}${pnl.percent}% (${hide.value ? "****" : pnl.amount})`,
                      badge: {
                        content: pnl.percent,
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
    });
  return items as TableRowItemProps[];
});

onMounted(() => {
  timeOut = setInterval(() => {
    getLeases();
  }, UPDATE_LEASES);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

function reload() {
  getLeases();
}

function getTitle(item: LeaseData) {
  if (item.leaseStatus.opening) {
    return `${i18n.t("message.opening")}...`;
  }

  const status = getStatus(item);

  if (status == TEMPLATES.opened) {
    if (isClosing(item)) {
      return `${i18n.t("message.closing")}...`;
    }

    if (isRepaying(item)) {
      return `${i18n.t("message.repaying")}...`;
    }
  }

  if (TEMPLATES.paid == status) {
    if (isCollecting(item)) {
      return `${i18n.t("message.collecting")}...`;
    }
  }

  return `#${item.leaseAddress.slice(-8)}`;
}

function getAssetIcon(item: LeaseData) {
  switch (ProtocolsConfig[item.protocol].type) {
    case PositionTypes.long: {
      if (item.leaseStatus?.opening) {
        return app.assetIcons?.[`${item.leaseStatus.opening.currency}@${item.protocol}`]!;
      }
      break;
    }
    case PositionTypes.short: {
      if (item.leaseStatus?.opening) {
        return app.assetIcons?.[`${item.leaseStatus.opening.loan.ticker}@${item.protocol}`]!;
      }
    }
  }
  return app.assetIcons?.[`${item.leaseData?.leasePositionTicker}@${item.protocol}`] as string;
}

function getAsset(lease: LeaseData) {
  switch (ProtocolsConfig[lease.protocol].type) {
    case PositionTypes.long: {
      const ticker =
        lease.leaseStatus?.opened?.amount.ticker ||
        lease.leaseStatus?.closing?.amount.ticker ||
        lease.leaseStatus?.opening?.currency;
      const item = AssetUtils.getCurrencyByTicker(ticker as string);

      const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
      return asset;
    }
    case PositionTypes.short: {
      const item = AssetUtils.getCurrencyByTicker(lease.leaseData!.leasePositionTicker as string);
      const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
      return asset;
    }
  }
}

function getAmount(lease: LeaseData) {
  switch (ProtocolsConfig[lease.protocol].type) {
    case PositionTypes.long: {
      const data =
        lease.leaseStatus?.opened?.amount ||
        lease.leaseStatus.opening?.downpayment ||
        lease.leaseStatus.closing?.amount;
      return data?.amount ?? "0";
    }
    case PositionTypes.short: {
      const data =
        lease.leaseStatus?.opened?.amount ||
        lease.leaseStatus.opening?.downpayment ||
        lease.leaseStatus.closing?.amount;

      const asset = app.currenciesData?.[`${lease.leaseData!.leasePositionTicker}@${lease.protocol}`]!;
      const lease_asset = app.currenciesData?.[`${lease.leaseData!.ls_asset_symbol}@${lease.protocol}`]!;
      const price = oracle.prices?.[asset?.ibcData as string];
      return new Dec(data!.amount, lease_asset.decimal_digits)
        .quo(new Dec(price.amount))
        .toString(lease_asset.decimal_digits);
    }
  }
}

function getPositionInStable(lease: LeaseData) {
  const amount =
    lease.leaseStatus?.opened?.amount || lease.leaseStatus.opening?.downpayment || lease.leaseStatus.closing?.amount;
  let protocol = lease.protocol;

  let ticker = lease.leaseData!.leasePositionTicker!;

  if (ticker?.includes?.("@")) {
    let [t, p] = ticker.split("@");
    ticker = t;
    protocol = p;
  }

  const asset = app.currenciesData?.[`${ticker}@${protocol}`];

  switch (ProtocolsConfig[lease.protocol].type) {
    case PositionTypes.long: {
      const price = oracle.prices?.[`${ticker}@${protocol}`];

      const value = new Dec(amount!.amount, asset?.decimal_digits).mul(new Dec(price?.amount));
      return value.toString(asset!.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : asset?.decimal_digits);
    }
    case PositionTypes.short: {
      const value = new Dec(amount!.amount, asset!.decimal_digits);
      return value.toString(asset!.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : asset?.decimal_digits);
    }
  }

  return "0";
}

function getActions(lease: LeaseData) {
  const status = getStatus(lease as LeaseData);
  const actions = [
    h<ButtonProps>(Button, {
      label: i18n.t("message.details"),
      severity: "secondary",
      size: "medium",
      key: `details-${lease.leaseAddress}`,
      onClick: () => {
        router.push(`/${RouteNames.LEASES}/${lease.protocol?.toLowerCase()}/${lease.leaseAddress}`);
      }
    }),
    h<IAction>(Action, {
      lease,
      showCollect: false,
      showClose: status == TEMPLATES.opened,
      key: `action-${lease.leaseAddress}`,
      opened: openMenuId == lease.leaseAddress,
      onClick: (data: boolean) => {
        if (data) {
          openMenuId = lease.leaseAddress;
        } else {
          openMenuId = null;
        }
      },
      onSharePnl: () => {
        sharePnlDialog.value?.show(lease);
      }
    })
  ];

  if (status == TEMPLATES.opened) {
    if (isClosing(lease) || isRepaying(lease)) {
      return [];
    }
  }
  return actions;
}

function isClosing(lease: LeaseData) {
  const progress = lease.leaseStatus.opened?.status as OpenedOngoingState;

  if (Object.prototype.hasOwnProperty.call(progress.in_progress ?? {}, "close")) {
    return true;
  }

  return false;
}

function isRepaying(lease: LeaseData) {
  const progress = lease.leaseStatus.opened?.status as OpenedOngoingState;

  if (Object.prototype.hasOwnProperty.call(progress.in_progress ?? {}, "repayment")) {
    return true;
  }

  return false;
}

function isCollecting(lease: LeaseData) {
  const data = lease.leaseStatus.closing;

  if (data?.in_progress == "transfer_in_init" || data?.in_progress == "transfer_in_finish") {
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

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);
    let c = 0;

    let am = new Dec(0);
    let dp = new Dec(0);
    let rp = new Dec(0);

    for (const lease of leases.value) {
      if (lease.leaseStatus?.opened) {
        const ticker = lease.leaseStatus.opened.amount.ticker;
        const dasset = app.currenciesData![`${ticker}@${lease.protocol}`];
        const lpn = AssetUtils.getLpnByProtocol(lease.protocol);
        const price = oracle.prices[lpn.key];
        const downpayment = lease.leaseData?.downPayment ? lease.leaseData?.downPayment : new Dec(0);
        const dDecimal = Number(dasset!.decimal_digits);
        const l = CurrencyUtils.calculateBalance(
          oracle.prices[dasset.key]?.amount,
          new Coin(dasset.ibcData, lease.leaseStatus.opened.amount.amount),
          dDecimal
        ).toDec();

        ls = ls.add(l);
        lease.debt = lease.debt.mul(new Dec(price?.amount));

        am = am.add(lease.pnlAmount as Dec);
        dp = dp.add(downpayment as Dec);
        rp = rp.add((lease.leaseData?.repayment_value ?? new Dec(0)) as Dec);

        c++;
      }
      db = db.add(lease.debt as Dec);
      pl = pl.add(lease.pnlAmount as Dec);
    }
    pnl.value = pl;
    activeLeases.value = ls;
    debt.value = db;

    const amount = dp.add(rp);

    if (!(amount.isZero() || am.isZero())) {
      pnl_percent.value = am.quo(dp.add(rp)).mul(new Dec(100));
    }

    Intercom.update({
      PositionsUnrealizedPnlUSD: pl.toString(),
      PositionsDebtUSD: db.toString(),
      Positionsvalueusd: ls.toString()
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
