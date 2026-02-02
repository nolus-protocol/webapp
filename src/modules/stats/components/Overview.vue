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
import { EtlApi, isMobile, Logger } from "@/common/utils";
import { ref, watch } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore } from "@/common/stores/config";

const txVolume = ref("0");
const buybackTotal = ref("0");
const realized_pnl = ref("0");
const protocolRevenue = ref("0");
const tvl = ref("0");
const configStore = useConfigStore();

const loading = ref(true);

watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized) {
      onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  try {
    // Use batch endpoint - single request instead of 5 separate requests
    const data = await EtlApi.fetchStatsOverviewBatch();

    if (data.tvl) {
      tvl.value = data.tvl.total_value_locked;
    }
    if (data.tx_volume) {
      txVolume.value = data.tx_volume.total_tx_value;
    }
    if (data.buyback_total) {
      buybackTotal.value = data.buyback_total.buyback_total;
    }
    if (data.realized_pnl_stats) {
      realized_pnl.value = data.realized_pnl_stats.amount;
    }
    if (data.revenue) {
      protocolRevenue.value = data.revenue.revenue;
    }
  } catch (e) {
    Logger.error(e);
  }
  loading.value = false;
}
</script>
