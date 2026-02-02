<template>
  <Widget>
    <WidgetHeader :label="$t('message.overview')" />
    <div class="flex flex-col gap-3 md:flex-row md:gap-8">
      <BigNumber
        :label="$t('message.tvl')"
        :amount="{
          amount: tvl,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          decimals: 0,
          fontSize: isMobile() ? 20 : 32,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.tx-volume')"
        :amount="{
          amount: txVolume,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          decimals: 0,
          fontSize: 20,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.realized-pnl')"
        :amount="{
          amount: realized_pnl,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          decimals: 0,
          fontSize: 20,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.protocol-revenue')"
        :amount="{
          amount: protocolRevenue,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: 20,
          decimals: 0,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.buyback')"
        :amount="{
          amount: buybackTotal,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_ASSET.label,
          decimals: 0,
          hasSpace: true,
          isDenomInfront: false,
          fontSize: 20,
          animatedReveal: true
        }"
        :loading="loading"
      />
    </div>

    <SupplyBorrowedChart />
    <hr class="my-6 border-t border-border-color" />
    <LeasesMonthlyChart />
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import SupplyBorrowedChart from "./SupplyBorrowedChart.vue";
import LeasesMonthlyChart from "@/modules/stats/components/LeasesMonthlyChart.vue";

import { Widget } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { isMobile } from "@/common/utils";
import { computed, watch } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore, useStatsStore } from "@/common/stores";

const configStore = useConfigStore();
const statsStore = useStatsStore();

// Computed properties from store
const tvl = computed(() => statsStore.overview.tvl);
const txVolume = computed(() => statsStore.overview.txVolume);
const buybackTotal = computed(() => statsStore.overview.buybackTotal);
const realized_pnl = computed(() => statsStore.overview.realizedPnlStats);
const protocolRevenue = computed(() => statsStore.overview.revenue);
const loading = computed(() => statsStore.overviewLoading && !statsStore.hasOverviewData);

watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized && !statsStore.initialized) {
      statsStore.initialize();
    }
  },
  {
    immediate: true
  }
);
</script>
