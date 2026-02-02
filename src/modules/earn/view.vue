<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.earn')">
      <div
        class="flex gap-2"
        v-if="wallet.wallet"
      >
        <Button
          :label="$t('message.supply')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.SUPPLY}`)"
        />
        <Button
          :label="$t('message.withdraw-title')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.WITHDRAW}`)"
        />
      </div>
    </ListHeader>
    <div class="flex flex-col gap-8 lg:flex-row">
      <EarnAssets
        :stableAmount="stableAmount"
        :anualYield="anualYield"
        :earningsAmount="earningsAmount"
        :items="assetsRows"
        class="order-2 overflow-x-auto md:overflow-auto lg:order-none lg:flex-[60%]"
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

import { computed, h, provide, ref, watch } from "vue";
import { type LabelProps, type TableRowItemProps } from "web-components";

import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY, NORMAL_DECIMALS } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { useEarnStore } from "@/common/stores/earn";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { IntercomService } from "@/common/utils/IntercomService";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { Dec } from "@keplr-wallet/unit";

const wallet = useWalletStore();
const earnStore = useEarnStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const i18n = useI18n();
const router = useRouter();
const search = ref("");

// Watch for wallet connection changes to refresh earn positions
watch(
  () => wallet.wallet?.address,
  async (address) => {
    if (address) {
      await earnStore.setAddress(address);
    } else {
      earnStore.clear();
    }
  },
  { immediate: true }
);

function onSearch(data: string) {
  search.value = data;
}

// Total value of user's earn positions in USD
const stableAmount = computed(() => {
  let total = new Dec(0);
  for (const position of earnStore.positions) {
    const pool = earnStore.getPool(position.protocol);
    if (pool) {
      const currency = configStore.getCurrency(pool.currency);
      if (currency) {
        const price = pricesStore.getPriceAsNumber(currency.key);
        const amount = new Dec(position.deposited_lpn, currency.decimal_digits);
        total = total.add(amount.mul(new Dec(price)));
      }
    }
  }
  
  // Update Intercom
  IntercomService.updateEarn({
    depositedUsd: total.toString(),
    poolsCount: earnStore.positions.length
  });
  
  return total.toString(2);
});

// Total earnings (rewards) from positions
// Note: EarnPosition doesn't have direct rewards - we calculate based on deposited_usd if available
const earningsAmount = computed(() => {
  let total = new Dec(0);
  for (const position of earnStore.positions) {
    if (position.deposited_usd) {
      // Use pre-calculated USD value if available
      total = total.add(new Dec(position.deposited_usd));
    }
  }
  // Return from total_deposited_usd for now (earnings calculation may need backend support)
  return earnStore.totalDepositedUsd ? new Dec(earnStore.totalDepositedUsd).toString(2) : "0.00";
});

// Projected annual yield based on current positions and APYs
const anualYield = computed(() => {
  let amount = new Dec(0);
  for (const position of earnStore.positions) {
    const pool = earnStore.getPool(position.protocol);
    if (pool) {
      const currency = configStore.getCurrency(pool.currency);
      if (currency) {
        const price = pricesStore.getPriceAsNumber(currency.key);
        const deposited = new Dec(position.deposited_lpn, currency.decimal_digits);
        const valueUsd = deposited.mul(new Dec(price));
        // pool.apy is a number (0.05 = 5%), not a percentage string
        const apy = new Dec(pool.apy);
        amount = amount.add(valueUsd.mul(apy));
      }
    }
  }
  return amount.toString(NORMAL_DECIMALS);
});

// Table rows for earn assets display
const assetsRows = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();
  
  // Map pools to display rows, filtering by search
  return earnStore.pools
    .filter((pool) => {
      if (param.length === 0) return true;
      const currency = configStore.getCurrency(pool.currency);
      if (!currency) return false;
      return (
        pool.protocol.toLowerCase().includes(param) ||
        currency.ticker.toLowerCase().includes(param) ||
        currency.key.toLowerCase().includes(param)
      );
    })
    .map((pool) => {
      const currency = configStore.getCurrency(pool.currency);
      const position = earnStore.getPosition(pool.protocol);
      
      // Get user's deposit amount for this pool
      const depositedAmount = position ? new Dec(position.deposited_lpn, currency?.decimal_digits ?? 6) : new Dec(0);
      const price = currency ? pricesStore.getPriceAsNumber(currency.key) : 0;
      const stableBalance = depositedAmount.mul(new Dec(price));
      
      // Check if pool is accepting deposits - utilization is a number (0-1)
      const isOpen = pool.utilization < 1;
      
      return {
        protocol: pool.protocol,
        balance: formatNumber(depositedAmount.toString(3), 3),
        stable_balance: formatNumber(stableBalance.toString(2), 2),
        stable_balance_number: parseFloat(stableBalance.toString(2)),
        // pool.apy is a number (0.05 = 5%), multiply by 100 for percentage display
        apr: new Dec(pool.apy).mul(new Dec(100)).toString(2),
        currency,
        isOpen
      };
    })
    .sort((a, b) => b.stable_balance_number - a.stable_balance_number)
    .map((item) => {
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
            value: item.currency?.ticker ?? item.protocol,
            subValue: item.currency?.key ?? "",
            image: item.currency?.icon,
            variant: "left"
          },
          { 
            value: `${item.balance}`, 
            subValue: `${NATIVE_CURRENCY.symbol}${item.stable_balance}`, 
            variant: "right" 
          },
          { value: `${item.apr}%`, class: "text-typography-success" },
          { component: statusComponent }
        ]
      };
    });
});

// Provide refresh function for child components
provide("loadLPNCurrency", () => earnStore.refresh());
</script>
