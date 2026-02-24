<template>
  <Table
    :columns="columns"
    searchable
    :size="mobile ? '' : `${assets.length} ${$t('message.assets')}`"
    :toggle="{ label: $t('message.show-small-balances'), value: smBalances }"
    @togle-value="setSmallBalancesState"
    :hide-values="{text: $t('message.toggle-values'), value: hide}"
    @hide-value="onHide"
    :tableClasses="mobile ? '' : 'min-w-[530px]'"
    :scrollable="!mobile"
    @on-input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
    @onSearchClear="onSearch('')"
  >
    <BigNumber
      :label="$t('message.assets-title')"
      :amount="{
        value: total.toString(2),
        hide: hide,
        denom: NATIVE_CURRENCY.symbol,
        fontSize: 24,
        animatedReveal: true,
        compact: mobile
      }"
    />

    <template v-slot:body>
      <TableRow
        v-for="(row, index) in assets"
        :key="index"
        :items="row.items"
        :scrollable="!mobile"
      />
    </template>
  </Table>
</template>

<script lang="ts" setup>
import BigNumber from "@/common/components/BigNumber.vue";
import type { TableColumnProps, TableRowItemProps } from "web-components";
import { Table, TableRow } from "web-components";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { usePricesStore } from "@/common/stores/prices";
import { computed, ref, watch } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { isMobile, Logger, WalletManager } from "@/common/utils";
import { formatPercent, formatTokenBalance, formatPriceUsd, formatUsd, formatMobileAmount, formatMobileUsd } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useNetworkCurrency, type ResolvedAsset } from "@/common/composables";

const i18n = useI18n();
const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const { getNetworkAssets } = useNetworkCurrency();
const mobile = isMobile();
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

const columns = computed<TableColumnProps[]>(() => mobile
  ? [
      { label: i18n.t("message.assets"), variant: "left" },
      { label: i18n.t("message.balance") }
    ]
  : [
      { label: i18n.t("message.assets"), variant: "left" },
      { label: i18n.t("message.price") },
      { label: i18n.t("message.balance") },
      {
        label: i18n.t("message.yield"),
        tooltip: { position: "top", content: i18n.t("message.earn-apr-tooltip") }
      }
    ]
);

const filteredAssets = computed(() => {
  const allAssets = getNetworkAssets();

  // Filter small balances if setting is off
  const filtered = showSmallBalances.value ? allAssets : allAssets.filter((a) => parseFloat(a.balance) > 1);

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
    return formatPercent(asset.apr);
  }
  if (asset.isNative) {
    return formatPercent(asset.stakingApr);
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
      const price = formatPriceUsd(item.price);
      const balanceDec = new Dec(item.balance, c.decimal_digits);
      const stableDec = new Dec(item.balanceUsd.toFixed(2));
      const balance = mobile ? formatMobileAmount(balanceDec) : formatTokenBalance(balanceDec);
      const stable_balance = mobile ? formatMobileUsd(stableDec) : formatUsd(item.balanceUsd);

      const balanceValue = hide.value
        ? { value: "****", subValue: "****", variant: "right" }
        : { value: `${balance}`, subValue: stable_balance, variant: "right" };

      if (mobile) {
        return {
          items: [
            {
              value: c.shortName,
              subValue: price,
              image: c.icon,
              variant: "left"
            },
            { ...balanceValue }
          ]
        } as TableRowItemProps;
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
          { value: price },
          balanceValue,
          { value: getYield(item), class: "text-typography-success" }
        ]
      } as TableRowItemProps;
    });
});

function setSmallBalancesState(event: boolean) {
  smBalances.value = event;
  WalletManager.setSmallBalances(event);
}
</script>
