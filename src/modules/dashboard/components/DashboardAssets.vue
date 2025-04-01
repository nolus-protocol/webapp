<template>
  <Widget class="!p-0">
    <WidgetHeader
      :label="$t('message.assets')"
      :icon="{ name: 'assets', class: 'fill-icon-link' }"
      :badge="{ content: filteredAssets.length.toString() }"
      class="px-6 pt-6"
    >
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="isVisible"
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
          v-if="isVisible"
          :label="$t('message.send')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${AssetsDialog.SEND}`)"
        />
      </div>
    </WidgetHeader>
    <BigNumber
      :label="$t('message.total-value')"
      class="px-6"
      :amount="{
        amount: total.toString(2),
        type: CURRENCY_VIEW_TYPES.CURRENCY,
        denom: NATIVE_CURRENCY.symbol
      }"
    />
    <Table
      :columns="columns"
      class="px-6"
    >
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in assets"
          :key="index"
          :items="row.items"
        />
      </template>
    </Table>
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

import { AssetsDialog } from "@/modules/assets/enums";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { computed, ref, watch } from "vue";
import { Coin, Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, Logger, WalletManager } from "@/common/utils";
import { NATIVE_CURRENCY, ProtocolsConfig } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { CurrencyMappingEarn } from "@/config/currencies";
import { useRouter } from "vue-router";

const i18n = useI18n();
const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const router = useRouter();
const total = ref(new Dec(0));
const hide = ref(WalletManager.getHideBalances());

defineProps<{ isVisible: boolean }>();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.assets"), variant: "left" },
  { label: i18n.t("message.price"), class: "hidden md:flex" },
  { label: i18n.t("message.balance") },
  {
    label: i18n.t("message.yield"),
    tooltip: { position: "top", content: i18n.t("message.earn-apr-tooltip") },
    class: "hidden md:flex"
  }
];

const filteredAssets = computed(() => {
  const balances = wallet.currencies;
  return balances
    .sort((a, b) => {
      const aAssetBalance = CurrencyUtils.calculateBalance(
        oracle.prices[a.key]?.amount,
        new Coin(a.balance.denom, a.balance.amount.toString()),
        a.decimal_digits as number
      ).toDec();

      const bAssetBalance = CurrencyUtils.calculateBalance(
        oracle.prices[b.key]?.amount,
        new Coin(b.balance.denom, b.balance.amount.toString()),
        b.decimal_digits as number
      ).toDec();

      return Number(bAssetBalance.sub(aAssetBalance).toString(8));
    })
    .slice(0, 5);
});

watch(
  () => [wallet.wallet, oracle.prices, wallet.balances],
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
  let totalAssets = new Dec(0);
  wallet.currencies.forEach((asset) => {
    const currency = AssetUtils.getCurrencyByDenom(asset.balance.denom);
    const assetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[asset.key]?.amount ?? 0,
      new Coin(currency.ibcData, asset.balance.amount.toString()),
      Number(currency.decimal_digits)
    );
    totalAssets = totalAssets.add(assetBalance.toDec());
  });
  total.value = totalAssets;
}

function isEarn(denom: string) {
  const curency = AssetUtils.getCurrencyByDenom(denom);
  const [_, protocol] = curency.key.split("@");
  if (!ProtocolsConfig[protocol].rewards) {
    return false;
  }

  const lpns = (app.lpn ?? []).map((item) => item.ticker);
  return lpns.includes(curency.ticker);
}

function getApr(key: string) {
  let [ticker] = key.split("@");
  let asset = (app.lpn ?? []).find((item) => item.key == key);
  if (!asset) {
    ticker = CurrencyMappingEarn[ticker]?.ticker ?? ticker;
    asset = (app.lpn ?? []).find((item) => item.ticker == ticker);
  }
  const [_, protocol] = asset?.key.split("@") ?? [];
  return AssetUtils.formatNumber(app.apr?.[protocol] ?? 0, 2);
}

function apr(denom: string, key: string) {
  if (isEarn(denom)) {
    return `${getApr(key)}%`;
  }

  if (app.native?.ibcData == denom) {
    return `${AssetUtils.formatNumber(wallet.apr, 2)}%`;
  }
}

const assets = computed<TableRowItemProps[]>(() => {
  return filteredAssets.value.map((item) => {
    const stable_b = CurrencyUtils.calculateBalance(
      oracle.prices[item.key]?.amount,
      new Coin(item.balance.denom, item.balance.amount.toString()),
      item.decimal_digits
    ).toDec();

    const price = AssetUtils.formatNumber(oracle.prices[item.key]?.amount ?? 0, 4);
    const balance = AssetUtils.formatNumber(new Dec(item.balance.amount, item.decimal_digits).toString(3), 3);
    const stable_balance = AssetUtils.formatNumber(stable_b.toString(2), 2);
    return {
      items: [
        {
          value: item.name,
          subValue: item.shortName,
          image: item.icon,
          variant: "left",
          textClass: "line-clamp-1 [display:-webkit-box]"
        },
        { value: `${NATIVE_CURRENCY.symbol}${price}`, class: "hidden md:flex" },
        {
          value: hide.value ? "****" : `${balance}`,
          subValue: hide.value ? "****" : `${NATIVE_CURRENCY.symbol}${stable_balance}`,
          variant: "right"
        },
        { value: apr(item.ibcData, item.key), class: "text-typography-success hidden md:flex" }
      ]
    };
  });
});
</script>
