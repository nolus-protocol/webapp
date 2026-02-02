<template>
  <Widget>
    <WidgetHeader :label="$t('message.leased-assets-total')" />
    <div class="flex flex-col gap-4 md:flex-row md:gap-8">
      <BigNumber
        :label="$t('message.open-posiitons-value')"
        :amount="{
          amount: openPositionValue,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          decimals: 0,
          fontSize: isMobile() ? 20 : 32
        }"
        :loading="loading"
      />
      <BigNumber
        :label="$t('message.open-interest')"
        :label-tooltip="{
          content: $t('message.open-interest-tooltip')
        }"
        :amount="{
          amount: openInterest,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: 20,
          decimals: 0
        }"
        :loading="loading"
      />
    </div>
    <LoansChart />
  </Widget>
</template>

<script lang="ts" setup>
import BigNumber from "@/common/components/BigNumber.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import LoansChart from "@/modules/stats/components/LoansChart.vue";
import { Widget } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { isMobile } from "@/common/utils";
import { computed, watch } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore, useStatsStore } from "@/common/stores";

const configStore = useConfigStore();
const statsStore = useStatsStore();

// Computed properties from store
const openPositionValue = computed(() => 
  statsStore.loansStats.openPositionValue?.open_position_value ?? "0"
);
const openInterest = computed(() => 
  statsStore.loansStats.openInterest?.open_interest ?? "0"
);
const loading = computed(() => statsStore.loansStatsLoading && !statsStore.hasLoansStats);

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
