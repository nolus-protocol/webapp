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
          fontSize: 24,
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
          fontSize: 24,
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
          fontSize: 24,
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
          fontSize: 24,
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
          fontSize: 24,
          animatedReveal: true
        }"
        :loading="loading"
      />
    </div>

    <div class="flex">
      <div class="flex flex-1 justify-center">
        <div class="flex items-center text-sm">
          <span class="m-2 block h-[4px] w-[12px] rounded bg-green-400"></span>{{ $t("message.supplied") }}
        </div>
        <div class="flex items-center text-sm">
          <span class="m-2 block h-[4px] w-[12px] rounded bg-blue-500"></span>{{ $t("message.borrowed-chart") }}
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span>{{ $t("message.period") }}:</span>
        <Dropdown
          id="period"
          :on-select="onPeriodChange"
          :options="periodOptions"
          :selected="periodOptions[1]"
          class="w-20"
          dropdownPosition="right"
          dropdownClassName="!min-w-10"
        />
      </div>
    </div>

    <SupplyBorrowedChart :period="chartPeriod" />
    <hr class="my-6 border-t border-border-color" />
    <LeasesMonthlyChart :period="chartPeriod" />
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import SupplyBorrowedChart from "./SupplyBorrowedChart.vue";
import LeasesMonthlyChart from "@/modules/stats/components/LeasesMonthlyChart.vue";

import { Widget, Dropdown } from "web-components";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore, useStatsStore } from "@/common/stores";

const i18n = useI18n();
const configStore = useConfigStore();
const statsStore = useStatsStore();

const periodOptions = ref([
  { label: `6${i18n.t("message.month_abr")}`, value: "6m" },
  { label: `12${i18n.t("message.month_abr")}`, value: "12m" },
  { label: i18n.t("message.all"), value: "all" }
]);

const chartPeriod = ref(periodOptions.value[0].value); // default 6m

function onPeriodChange(data: { label: string; value: string }) {
  chartPeriod.value = data.value;
}

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
