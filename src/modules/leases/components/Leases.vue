<template>
  <ListHeader :title="$t('message.leases')">
    <Button
      v-if="wallet.wallet"
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
        :size="isTablet() ? '' : `${leasesData.length} leases`"
        :columns="leasesData.length > 0 ? columns : []"
        tableWrapperClasses="min-w-[900px] pr-6 md:min-w-auto md:p-0"
        :hide-values="isTablet() ? undefined : { text: $t('message.toggle-values'), value: hide }"
        @hide-value="onHide"
        @onSearchClear="onSearch('')"
        @on-input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
      >
        <div class="flex gap-8">
          <BigNumber
            :label="$t('message.unrealized-pnl')"
            :amount="{
              amount: pnl.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol
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
            :label="$t('message.leases')"
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
          <span class="hidden border-r border-border-color md:block" />
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
              :label="$t('message.pnl-history')"
              severity="secondary"
              size="small"
              @click="router.push(`/${RouteNames.LEASES}/pnl-log`)"
            />
          </div>
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
import Collect, { type ICollect } from "./single-lease/Collect.vue";
import SharePnLDialog from "@/modules/leases/components/single-lease/SharePnLDialog.vue";

import { useI18n } from "vue-i18n";
import { type Component, computed, h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { CURRENCY_VIEW_TYPES, type LeaseData } from "@/common/types";
import { AssetUtils, EtlApi, formatDate, isTablet, Logger, WalletManager } from "@/common/utils";

import { useLeases } from "@/common/composables";
import { Coin, Dec } from "@keplr-wallet/unit";
import { Intercom } from "@/common/utils/Intercom";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useApplicationStore } from "@/common/stores/application";
import { MAX_DECIMALS, NATIVE_CURRENCY, PositionTypes, ProtocolsConfig, UPDATE_LEASES } from "@/config/global";
import { CurrencyDemapping } from "@/config/currencies";
import { useRouter } from "vue-router";
import { getStatus, TEMPLATES } from "./common";
import { SingleLeaseDialog } from "../enums";
import type { IAction } from "./single-lease/Action.vue";
import Action from "./single-lease/Action.vue";

const { leases, getLeases, leaseLoaded } = useLeases((error: Error | any) => {});
const activeLeases = ref(new Dec(0));
const pnl = ref(new Dec(0));
const debt = ref(new Dec(0));
const realized_pnl = ref(new Dec(0));
const pnl_percent = ref(new Dec(0));
const router = useRouter();
const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const i18n = useI18n();
const hide = ref(WalletManager.getHideBalances());
const search = ref("");
const sharePnlDialog = ref<typeof SharePnLDialog | null>(null);

let timeOut: NodeJS.Timeout;

const columns: TableColumnProps[] = [
  { label: i18n.t("message.lease"), variant: "left", class: "max-w-[150px]" },
  { label: i18n.t("message.asset"), variant: "left" },
  { label: i18n.t("message.type"), variant: "left", class: "max-w-[70px]" },
  { label: i18n.t("message.pnl"), class: "max-w-[200px]" },
  { label: i18n.t("message.lease-size") },
  { label: i18n.t("message.opened-on"), class: "max-w-[200px]" },
  { label: "", class: "max-w-[180px]" }
];

const leasesData = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();
  const items = leases.value
    .filter((item) => {
      if (param.length == 0) {
        return true;
      }

      if (
        item.leaseAddress.toLowerCase().includes(param) ||
        item.leaseData?.leasePositionTicker?.toLowerCase().includes(param)
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
      const date = item.leaseData?.timestamp
        ? `${formatDate(item.leaseData?.timestamp?.toString())?.toUpperCase()}`
        : "";
      const asset = getAsset(item as LeaseData)!;
      const amount = new Dec(getAmount(item as LeaseData) ?? 0, asset.decimal_digits);
      const stable = getPositionInStable(item as LeaseData);
      const actions: Component[] = getActions(item as LeaseData);
      const value = {
        subValue: `${NATIVE_CURRENCY.symbol}${stable}`,
        value: `${amount.toString(asset.decimal_digits)} ${asset.shortName}`
      };

      if (hide.value) {
        value.value = "****";
        value.subValue = "****";
      }

      return {
        items: [
          {
            value: getTitle(item as LeaseData),
            // subValue: getSubValue(item as LeaseData),
            subValueClass: "text-typography-secondary rounded border-[1px] px-2 py-1 self-start	",
            variant: "left",
            click: () => {
              router.push(`/${RouteNames.LEASES}/${item.protocol.toLocaleLowerCase()}/${item.leaseAddress}`);
            },
            class: "text-typography-link font-semibold max-w-[150px] cursor-pointer"
          },
          {
            image: getAssetIcon(item as LeaseData),
            value: asset.name,
            subValue: asset.shortName,
            variant: "left"
          },
          {
            value: `${i18n.t(`message.${ProtocolsConfig[item.protocol].type}`)}`,
            variant: "left",
            class: "max-w-[70px]"
          },
          {
            component: () =>
              h<IBigNumber>(BigNumber, {
                pnlStatus: {
                  positive: pnl.status,
                  value: `${pnl.status ? "+" : ""}${pnl.percent}% (${pnl.amount})`,
                  badge: {
                    content: pnl.percent,
                    base: false
                  }
                }
              }),
            class: "max-w-[200px]"
          },
          {
            ...value,
            class: "font-semibold"
          },
          { value: date, class: "max-w-[200px]" },
          {
            component: () => [...actions],
            class: "max-w-[180px] pr-4 cursor-pointer"
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
      if (item.leaseStatus?.opening && item.leaseData) {
        return (
          (app.assetIcons?.[item.leaseData?.leasePositionTicker as string] as string) ??
          app.assetIcons?.[`${item.leaseStatus.opening.loan.ticker}@${item.protocol}`]
        );
      }
      break;
    }
    case PositionTypes.short: {
      if (item.leaseStatus?.opening && item.leaseData) {
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
        lease.leaseStatus?.paid?.amount.ticker ||
        lease.leaseStatus?.opening?.downpayment.ticker;
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
        lease.leaseStatus?.opened?.amount || lease.leaseStatus.opening?.downpayment || lease.leaseStatus.paid?.amount;
      return data?.amount ?? "0";
    }
    case PositionTypes.short: {
      const data =
        lease.leaseStatus?.opened?.amount || lease.leaseStatus.opening?.downpayment || lease.leaseStatus.paid?.amount;

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
    lease.leaseStatus?.opened?.amount || lease.leaseStatus.opening?.downpayment || lease.leaseStatus.paid?.amount;
  let protocol = lease.protocol;

  let ticker = lease.leaseData!.leasePositionTicker!;

  if (ticker.includes("@")) {
    let [t, p] = ticker.split("@");
    ticker = t;
    protocol = p;
  }

  if (CurrencyDemapping[ticker]) {
    ticker = CurrencyDemapping[ticker].ticker;
  }

  const asset = app.currenciesData?.[`${ticker}@${protocol}`];

  switch (ProtocolsConfig[lease.protocol].type) {
    case PositionTypes.long: {
      const price = oracle.prices?.[`${ticker}@${protocol}`];

      const value = new Dec(amount!.amount, asset?.decimal_digits).mul(new Dec(price.amount));
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
    h<IAction>(Action, {
      lease,
      key: `action-${lease.leaseAddress}`,
      onSharePnl: () => {
        sharePnlDialog.value?.show(lease);
      }
    })
  ];

  if (status == TEMPLATES.opened) {
    if (isClosing(lease) || isRepaying(lease)) {
      return [];
    }
    actions.unshift(
      h<ButtonProps>(Button, {
        label: i18n.t("message.close"),
        severity: "secondary",
        size: "medium",
        key: `close-${lease.leaseAddress}`,
        onClick: () => {
          router.push({
            path: `/${RouteNames.LEASES}/${SingleLeaseDialog.CLOSE}/${lease.protocol?.toLowerCase()}/${lease.leaseAddress}`
          });
        }
      })
    );
  }
  if (status == TEMPLATES.paid && !isCollecting(lease)) {
    actions.unshift(
      h<ICollect>(Collect, {
        severity: "secondary",
        lease: lease,
        key: `collect-${lease.leaseAddress}`
      })
    );
  }

  return actions;
}

function getSubValue(lease: LeaseData) {
  const status = getStatus(lease as LeaseData);

  if (status == TEMPLATES.opened) {
    if (isClosing(lease)) {
      return i18n.t("message.closing");
    }

    if (isRepaying(lease)) {
      return i18n.t("message.repaying");
    }
  }

  if (TEMPLATES.paid == status) {
    if (isCollecting(lease)) {
      return i18n.t("message.collecting");
    }
  }

  return "";
}

function isClosing(lease: LeaseData) {
  const data = lease.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "close")) {
    return true;
  }

  return false;
}

function isRepaying(lease: LeaseData) {
  const data = lease.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "repayment")) {
    return true;
  }

  return false;
}

function isCollecting(lease: LeaseData) {
  const data = lease.leaseStatus.paid;

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

watch(
  () => wallet.wallet,
  async () => {
    try {
      getRealizedPnl();
    } catch (e) {
      Logger.error(e);
    }
  },
  {
    immediate: true
  }
);

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);
    let pnlPercent = new Dec(0);
    let count = 0;
    for (const lease of leases.value) {
      if (lease.leaseStatus?.opened) {
        const dasset = app.currenciesData![`${lease.leaseStatus.opened.amount.ticker}@${lease.protocol}`];
        const lpn = AssetUtils.getLpnByProtocol(lease.protocol);
        const price = oracle.prices[lpn.key];
        const downpayment = (lease.leaseData?.downPayment ? lease.leaseData?.downPayment : new Dec(0)).add(
          (lease.leaseData?.repayment_value as Dec) ?? new Dec(0)
        );
        const dDecimal = Number(dasset!.decimal_digits);
        const l = CurrencyUtils.calculateBalance(
          oracle.prices[dasset.key]?.amount,
          new Coin(dasset.ibcData, lease.leaseStatus.opened.amount.amount),
          dDecimal
        ).toDec();

        ls = ls.add(l);
        lease.debt = lease.debt.mul(new Dec(price.amount));
        pnlPercent = pnlPercent.add(lease.pnlAmount.quo(downpayment as Dec).mul(new Dec(100)));
        count++;
      }
      db = db.add(lease.debt as Dec);
      pl = pl.add(lease.pnlAmount as Dec);
    }
    activeLeases.value = ls;
    debt.value = db;
    pnl.value = pl;
    if (count) {
      pnl_percent.value = pnlPercent.quo(new Dec(count));
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

async function getRealizedPnl() {
  try {
    const data = await EtlApi.fetchRealizedPNL(wallet?.wallet?.address);
    realized_pnl.value = new Dec(data.realized_pnl);
  } catch (error) {
    console.error(error);
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
