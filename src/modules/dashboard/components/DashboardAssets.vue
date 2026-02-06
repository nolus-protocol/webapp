<template>
  <Widget class="!p-0">
    <WidgetHeader
      :label="walletConnected && !isEmpty ? $t('message.assets') : ''"
      :icon="walletConnected && !isEmpty ? { name: 'assets', class: 'fill-icon-link' } : undefined"
      :badge="walletConnected && !isEmpty ? { content: filteredAssets.length.toString() } : undefined"
      class="px-6 pt-6"
    >
      <template v-if="walletConnected && !isEmpty">
        <div class="flex flex-wrap gap-2">
          <Button
            :label="$t('message.swap')"
            severity="secondary"
            size="large"
            @click="() => router.push(`/${AssetsDialog.SWAP}`)"
          />
          <Button
            :label="$t('message.receive')"
            severity="secondary"
            size="large"
            @click="() => router.push(`/${AssetsDialog.RECEIVE}`)"
          />
          <Button
            :label="$t('message.send')"
            severity="secondary"
            size="large"
            @click="() => router.push(`/${AssetsDialog.SEND}`)"
          />
        </div>
      </template>
    </WidgetHeader>
    <template v-if="walletConnected && !isEmpty">
      <BigNumber
        :label="$t('message.total-value')"
        class="px-6"
        :amount="{
          amount: total.toString(2),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: isMobile() ? 20 : 32,
          animatedReveal: true
        }"
      />
      <Table
        :columns="columns"
        class="px-6"
        :scrollable="false"
      >
        <template v-slot:body>
          <TableRow
            v-for="(row, index) in assets"
            :key="index"
            :items="row.items"
            :scrollable="false"
          />
        </template>
      </Table>
    </template>
    <template v-else>
      <EmptyState
        :slider="[
          {
            image: { name: 'deposit-assets' },
            title: $t('message.assets'),
            description: $t('message.deposit-assets'),
            button: wallet.wallet
              ? { name: $t('message.receive'), icon: 'plus', url: `/${AssetsDialog.RECEIVE}` }
              : undefined
          }
        ]"
      />
    </template>
    <div class="flex justify-center rounded-b-xl border-t border-border-color bg-neutral-bg-1 p-3">
      <Button
        :label="$t('message.view-all-assets')"
        class="w-full"
        severity="tertiary"
        size="medium"
        @click="() => router.push(`/${RouteNames.ASSETS}`)"
      />
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import type { TableColumnProps, TableRowItemProps } from "web-components";
import { Button, Table, TableRow, Widget } from "web-components";
import { RouteNames } from "@/router";
import { CURRENCY_VIEW_TYPES } from "@/common/types";

import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import EmptyState from "@/common/components/EmptyState.vue";

import { AssetsDialog } from "@/modules/assets/enums";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { usePricesStore } from "@/common/stores/prices";
import { computed, ref, watch } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { isMobile, Logger, WalletManager } from "@/common/utils";
import { formatNumber, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useNetworkCurrency, useWalletConnected, type ResolvedAsset } from "@/common/composables";
import { useRouter } from "vue-router";

const i18n = useI18n();
const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const { getNetworkAssets } = useNetworkCurrency();
const walletConnected = useWalletConnected();
const router = useRouter();
const total = ref(new Dec(0));
const hide = ref(WalletManager.getHideBalances());

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.assets"), variant: "left" },
  { label: i18n.t("message.price"), class: "md:flex hidden" },
  { label: i18n.t("message.balance") },
  {
    label: i18n.t("message.yield"),
    tooltip: { position: "top", content: i18n.t("message.earn-apr-tooltip") },
    class: "md:flex hidden"
  }
]);

const filteredAssets = computed(() => {
  return getNetworkAssets()
    .filter((a) => parseFloat(a.balance) > 0)
    .sort((a, b) => b.balanceUsd - a.balanceUsd)
    .slice(0, 5);
});

const isEmpty = computed(() => filteredAssets.value.length === 0);

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

function setAvailableAssets() {
  let totalAssets = 0;
  for (const asset of getNetworkAssets()) {
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
  return filteredAssets.value.map((item) => {
    const c = item.currency;
    const price = formatNumber(item.price, 4);
    const balance = formatTokenBalance(new Dec(item.balance, c.decimal_digits));
    const stable_balance = formatNumber(item.balanceUsd.toFixed(2), 2);
    return {
      items: [
        {
          value: c.shortName,
          subValue: c.name,
          image: c.icon,
          variant: "left",
          textClass: "line-clamp-1 [display:-webkit-box]"
        },
        { value: `${NATIVE_CURRENCY.symbol}${price}`, class: "md:flex hidden" },
        {
          value: hide.value ? "****" : `${balance}`,
          subValue: hide.value ? "****" : `${NATIVE_CURRENCY.symbol}${stable_balance}`,
          variant: "right"
        },
        { value: getYield(item), class: "text-typography-success md:flex hidden" }
      ]
    };
  });
});
</script>
