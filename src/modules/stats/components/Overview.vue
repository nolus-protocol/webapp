<template>
  <Widget>
    <WidgetHeader :label="$t('message.overview')" />
    <div class="flex flex-row flex-wrap gap-4 md:gap-8">
      <BigNumber
        :label="$t('message.tvl')"
        :amount="{
          value: tvl,
          denom: NATIVE_CURRENCY.symbol,
          compact: true,
          fontSize: mobile ? 24 : 32,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.tx-volume')"
        :amount="{
          value: txVolume,
          denom: NATIVE_CURRENCY.symbol,
          compact: true,
          fontSize: 20,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.realized-pnl')"
        :amount="{
          value: realized_pnl,
          denom: NATIVE_CURRENCY.symbol,
          compact: true,
          fontSize: 20,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        class="hidden md:block"
        :label="$t('message.protocol-revenue')"
        :amount="{
          value: protocolRevenue,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: 20,
          compact: true,
          animatedReveal: true
        }"
        :loading="loading"
      />
      <BigNumber
        class="hidden md:block"
        :label="$t('message.buyback')"
        :amount="{
          value: buybackTotal,
          denom: NATIVE_ASSET.label,
          compact: true,
          hasSpace: true,
          isDenomPrefix: false,
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
import { isMobile } from "@/common/utils";
import { computed, watch } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore, useStatsStore } from "@/common/stores";

const mobile = isMobile();
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
