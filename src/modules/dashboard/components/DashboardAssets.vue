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
import { useBalancesStore } from "@/common/stores/balances";
import { usePricesStore } from "@/common/stores/prices";
import { computed, ref, watch } from "vue";
import { Coin, Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { isMobile, Logger, WalletManager } from "@/common/utils";
import { getCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY, ProtocolsConfig } from "@/config/global";
import { useConfigStore } from "@/common/stores/config";
import { useEarnStore } from "@/common/stores/earn";
import { useRouter } from "vue-router";

const i18n = useI18n();
const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const earnStore = useEarnStore();
const router = useRouter();
const total = ref(new Dec(0));
const hide = ref(WalletManager.getHideBalances());

defineProps<{ isVisible: boolean }>();

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
  const balances = balancesStore.filteredBalances;
  return balances
    .sort((a, b) => {
      const aAssetBalance = CurrencyUtils.calculateBalance(
        pricesStore.prices[a.key]?.price,
        new Coin(a.balance.denom, a.balance.amount.toString()),
        a.decimal_digits as number
      ).toDec();

      const bAssetBalance = CurrencyUtils.calculateBalance(
        pricesStore.prices[b.key]?.price,
        new Coin(b.balance.denom, b.balance.amount.toString()),
        b.decimal_digits as number
      ).toDec();

      return Number(bAssetBalance.sub(aAssetBalance).toString(8));
    })
    .slice(0, 5);
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

function setAvailableAssets() {
  let totalAssets = new Dec(0);
  balancesStore.filteredBalances.forEach((asset) => {
    const currency = getCurrencyByDenom(asset.balance.denom);
    const assetBalance = CurrencyUtils.calculateBalance(
      pricesStore.prices[asset.key]?.price ?? "0",
      new Coin(currency.ibcData, asset.balance.amount.toString()),
      Number(currency.decimal_digits)
    );
    totalAssets = totalAssets.add(assetBalance.toDec());
  });
  total.value = totalAssets;
}

function isEarn(denom: string) {
  const curency = getCurrencyByDenom(denom);
  const [_, protocol] = curency.key.split("@");
  if (!ProtocolsConfig[protocol].rewards) {
    return false;
  }

  const lpns = (configStore.lpn ?? []).map((item) => item.ticker);
  return lpns.includes(curency.ticker);
}

function getApr(key: string) {
  let [ticker] = key.split("@");
  let asset = (configStore.lpn ?? []).find((item) => item.key == key);
  if (!asset) {
    asset = (configStore.lpn ?? []).find((item) => item.ticker == ticker);
  }
  const [_, protocol] = asset?.key.split("@") ?? [];
  return formatNumber(earnStore.getProtocolApr(protocol) ?? 0, 2);
}

function apr(denom: string, key: string) {
  if (isEarn(denom)) {
    return `${getApr(key)}%`;
  }

  if (configStore.native?.ibcData == denom) {
    return `${formatNumber(wallet.apr, 2)}%`;
  }
}

const assets = computed<TableRowItemProps[]>(() => {
  return filteredAssets.value.map((item) => {
    const stable_b = CurrencyUtils.calculateBalance(
      pricesStore.prices[item.key]?.price,
      new Coin(item.balance.denom, item.balance.amount.toString()),
      item.decimal_digits
    ).toDec();

    const price = formatNumber(pricesStore.prices[item.key]?.price ?? "0", 4);
    const balance = formatNumber(new Dec(item.balance.amount, item.decimal_digits).toString(3), 3);
    const stable_balance = formatNumber(stable_b.toString(2), 2);
    return {
      items: [
        {
          value: item.shortName,
          subValue: item.name,
          image: item.icon,
          variant: "left",
          textClass: "line-clamp-1 [display:-webkit-box]"
        },
        { value: `${NATIVE_CURRENCY.symbol}${price}`, class: "md:flex hidden" },
        {
          value: hide.value ? "****" : `${balance}`,
          subValue: hide.value ? "****" : `${NATIVE_CURRENCY.symbol}${stable_balance}`,
          variant: "right"
        },
        { value: apr(item.ibcData, item.key), class: "text-typography-success md:flex hidden" }
      ]
    };
  });
});
</script>
