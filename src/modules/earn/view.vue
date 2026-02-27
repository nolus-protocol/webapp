<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.earn')">
      <Button
        v-if="wallet.wallet"
        :label="$t('message.supply')"
        severity="secondary"
        size="large"
        @click="() => router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.SUPPLY}`)"
      />
      <Button
        v-if="wallet.wallet"
        :label="$t('message.withdraw-title')"
        severity="secondary"
        size="large"
        @click="() => router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.WITHDRAW}`)"
      />
    </ListHeader>
    <div class="flex flex-col gap-8 lg:flex-row">
      <EarnAssets
        :stableAmount="stableAmount"
        :anualYield="anualYield"
        :earningsAmount="earningsAmount"
        :items="assetsRows"
        class="order-2 overflow-auto lg:order-none lg:flex-[60%]"
        :onSearch="onSearch"
      />
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import ListHeader from "@/common/components/ListHeader.vue";
import PausedLabel from "./components/PausedLabel.vue";
import { Button } from "web-components";
import { RouteNames } from "@/router";

import { EarnAssets } from "./components";
import { EarnAssetsDialog } from "./enums";

import { computed, h, provide, ref } from "vue";
import { type LabelProps, type TableRowItemProps } from "web-components";

import {
  formatTokenBalance,
  formatUsd,
  formatMobileAmount,
  formatMobileUsd,
  formatPercent
} from "@/common/utils/NumberFormatUtils";
import { isMobile } from "@/common/utils";
import { NORMAL_DECIMALS } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { useEarnStore } from "@/common/stores/earn";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { useAnalyticsStore } from "@/common/stores/analytics";

import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Dec } from "@keplr-wallet/unit";

const mobile = isMobile();
const wallet = useWalletStore();
const earnStore = useEarnStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const analyticsStore = useAnalyticsStore();
const i18n = useI18n();
const router = useRouter();
const search = ref("");

// Wallet changes are handled by connectionStore.connectWallet() in entry-client.ts

function onSearch(data: string) {
  search.value = data;
}

// Total value of user's earn positions in USD
const stableAmount = computed(() => {
  let total = new Dec(0);
  for (const position of earnStore.positions) {
    const pool = earnStore.getPool(position.protocol);
    if (pool) {
      const key = `${pool.currency}@${pool.protocol}`;
      const currency = configStore.currenciesData[key];
      if (currency) {
        const price = pricesStore.getPriceAsNumber(currency.key);
        const amount = new Dec(position.deposited_lpn, currency.decimal_digits);
        total = total.add(amount.mul(new Dec(price)));
      }
    }
  }

  return total.toString(2);
});

// Total earnings (rewards) from ETL via analytics store
const earningsAmount = computed(() => {
  return analyticsStore.earnings?.earnings ?? "0.00";
});

// Projected annual yield based on current positions and APYs
const anualYield = computed(() => {
  let amount = new Dec(0);
  for (const position of earnStore.positions) {
    const pool = earnStore.getPool(position.protocol);
    if (pool) {
      const key = `${pool.currency}@${pool.protocol}`;
      const currency = configStore.currenciesData[key];
      if (currency) {
        const price = pricesStore.getPriceAsNumber(currency.key);
        const deposited = new Dec(position.deposited_lpn, currency.decimal_digits);
        const valueUsd = deposited.mul(new Dec(price));
        // pool.apy is in percentage format (e.g., 5.25 for 5.25%), divide by 100 for calculation
        const apy = new Dec(pool.apy).quo(new Dec(100));
        amount = amount.add(valueUsd.mul(apy));
      }
    }
  }
  return amount.toString(NORMAL_DECIMALS);
});

// Table rows for earn assets display
const assetsRows = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();

  const activeProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);

  // Map pools to display rows, filtering by network and search
  return earnStore.pools
    .filter((pool) => {
      // Filter by selected network
      if (!activeProtocols.includes(pool.protocol)) return false;

      if (param.length === 0) return true;
      const key = `${pool.currency}@${pool.protocol}`;
      const currency = configStore.currenciesData[key];
      if (!currency) return false;
      return (
        pool.protocol.toLowerCase().includes(param) ||
        currency.ticker.toLowerCase().includes(param) ||
        currency.shortName.toLowerCase().includes(param) ||
        currency.name.toLowerCase().includes(param)
      );
    })
    .map((pool) => {
      const key = `${pool.currency}@${pool.protocol}`;
      const currency = configStore.currenciesData[key];
      const position = earnStore.getPosition(pool.protocol);

      // Get user's deposit amount for this pool
      const depositedAmount = position ? new Dec(position.deposited_lpn, currency?.decimal_digits ?? 6) : new Dec(0);
      const price = currency ? pricesStore.getPriceAsNumber(currency.key) : 0;
      const stableBalance = depositedAmount.mul(new Dec(price));

      // Check if pool is accepting deposits
      // deposit_capacity is null (unlimited) or a string amount from the LPP contract
      // When deposit_capacity is "0", the pool is full and cannot accept new deposits
      const isOpen =
        pool.deposit_capacity === null || pool.deposit_capacity === undefined || Number(pool.deposit_capacity) > 0;

      return {
        protocol: pool.protocol,
        balance: mobile ? formatMobileAmount(depositedAmount) : formatTokenBalance(depositedAmount),
        stable_balance: mobile ? formatMobileUsd(stableBalance) : formatUsd(stableBalance.toString(2)),
        stable_balance_number: parseFloat(stableBalance.toString(2)),
        // pool.apy is already in percentage format from backend (e.g., 5.25 for 5.25%)
        apr: formatPercent(pool.apy),
        currency,
        isOpen
      };
    })
    .sort((a, b) => b.stable_balance_number - a.stable_balance_number)
    .map((item) => {
      if (mobile) {
        return {
          items: [
            {
              value: item.currency?.shortName ?? item.protocol,
              subValue: item.apr,
              subValueClass: "text-typography-success",
              image: item.currency?.icon,
              variant: "left"
            },
            {
              value: `${item.balance}`,
              subValue: item.stable_balance,
              variant: "right"
            }
          ]
        };
      }

      const statusComponent = item.isOpen
        ? () =>
            h<LabelProps>(PausedLabel, {
              value: i18n.t("message.open"),
              variant: "success",
              class: "flex items-center"
            })
        : () =>
            h<LabelProps>(PausedLabel, {
              value: i18n.t("message.paused"),
              variant: "warning",
              class: "flex items-center"
            });

      return {
        items: [
          {
            value: item.currency?.shortName ?? item.protocol,
            subValue: item.currency?.name ?? "",
            image: item.currency?.icon,
            variant: "left"
          },
          {
            value: `${item.balance}`,
            subValue: item.stable_balance,
            variant: "right"
          },
          { value: item.apr, class: "text-typography-success" },
          { component: statusComponent }
        ]
      };
    });
});

// Provide refresh function for child components
provide("loadLPNCurrency", () => earnStore.refresh());
</script>
