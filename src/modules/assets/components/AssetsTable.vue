<template>
  <Table
    :columns="columns"
    searchable
    :size="isMobile() ? '' : `${assets.length} ${$t('message.assets')}`"
    :toggle="{ label: $t('message.show-small-balances'), value: smBalances }"
    @togle-value="setSmallBalancesState"
    :hide-values="{ text: $t('message.toggle-values'), value: hide }"
    @hide-value="onHide"
    tableClasses="min-w-[530px]"
    @on-input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
    header-classes="md:flex-row flex-col items-stretch md:items-center gap-4 md:gap-2"
    @onSearchClear="onSearch('')"
  >
    <BigNumber
      :label="$t('message.assets-title')"
      :amount="{
        amount: total.toString(2),
        hide: hide,
        type: CURRENCY_VIEW_TYPES.CURRENCY,
        denom: NATIVE_CURRENCY.symbol,
        fontSize: isMobile() ? 20 : 32,
        animatedReveal: true
      }"
    />

    <template v-slot:body>
      <TableRow
        v-for="(row, index) in assets"
        :key="index"
        :items="row.items"
      />
    </template>
  </Table>
</template>

<script lang="ts" setup>
import BigNumber from "@/common/components/BigNumber.vue";
import type { TableColumnProps, TableRowItemProps } from "web-components";
import { Table, TableRow } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { usePricesStore } from "@/common/stores/prices";
import { computed, ref, watch } from "vue";
import { Dec, Int } from "@keplr-wallet/unit";
import { Logger, WalletManager } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useNetworkCurrency, type ResolvedAsset } from "@/common/composables";
import { isMobile } from "@/common/utils";

const i18n = useI18n();
const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const { getNetworkAssets } = useNetworkCurrency();
const hide = ref(WalletManager.getHideBalances());
const total = ref(new Dec(0));
const smBalances = ref(WalletManager.getSmallBalances());

const showSmallBalances = computed(() => {
  if (!wallet.wallet) {
    return true;
  }
  return smBalances.value;
});
const search = ref("");

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.assets"), variant: "left" },
  { label: i18n.t("message.price"), class: "md:flex" },
  { label: i18n.t("message.balance") },
  {
    label: i18n.t("message.yield"),
    tooltip: { position: "top", content: i18n.t("message.earn-apr-tooltip") },
    class: "md:flex"
  }
]);

const filteredAssets = computed(() => {
  const allAssets = getNetworkAssets();

  // Filter small balances if setting is off
  const filtered = showSmallBalances.value
    ? allAssets
    : allAssets.filter((a) => parseFloat(a.balance) > 1);

  // Sort by USD balance value (descending)
  return filtered.sort((a, b) => b.balanceUsd - a.balanceUsd);
});

watch(
  () => [wallet.wallet, pricesStore.prices, balancesStore.balances],
  async () => {
    try {
      setAvailableAssets();
    } catch (e) {
      Logger.error(e);
    }
  },
  {
    immediate: true
  }
);

function onHide(data: boolean) {
  hide.value = data;
  WalletManager.setHideBalances(data);
}

function onSearch(data: string) {
  search.value = data;
}

function setAvailableAssets() {
  let totalAssets = 0;
  for (const asset of filteredAssets.value) {
    totalAssets += asset.balanceUsd;
  }
  total.value = new Dec(totalAssets.toFixed(2));
}

function getYield(asset: ResolvedAsset): string | undefined {
  if (asset.isEarnable) {
    return `${formatNumber(asset.apr, 2)}%`;
  }
  if (asset.isNative) {
    return `${formatNumber(asset.stakingApr, 2)}%`;
  }
}

const assets = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();
  return filteredAssets.value
    .filter((item) => {
      if (param.length == 0) {
        return true;
      }
      const c = item.currency;
      return (
        c.name.toLowerCase().includes(param) ||
        c.shortName.toLowerCase().includes(param) ||
        c.ibcData.toLowerCase().includes(param)
      );
    })
    .map((item) => {
      const c = item.currency;
      const price = formatNumber(item.price, 4);
      const balance = formatNumber(new Dec(item.balance, c.decimal_digits).toString(3), 3);
      const stable_balance = formatNumber(item.balanceUsd.toFixed(2), 2);

      const value = { value: `${balance}`, subValue: `${NATIVE_CURRENCY.symbol}${stable_balance}`, variant: "right" };

      if (hide.value) {
        value.value = "****";
        value.subValue = "****";
      }

      return {
        items: [
          {
            value: c.shortName,
            subValue: c.name,
            image: c.icon,
            variant: "left",
            textClass: "line-clamp-1 [display:-webkit-box]"
          },
          { value: `${NATIVE_CURRENCY.symbol}${price}`, class: "md:flex" },
          value,
          { value: getYield(item), class: "text-typography-success md:flex" }
        ]
      } as TableRowItemProps;
    });
});

function setSmallBalancesState(event: boolean) {
  smBalances.value = event;
  WalletManager.setSmallBalances(event);
}
</script>
