<template>
  <Widget>
    <WidgetHeader :label="$t('message.overview')" />
    <div class="flex flex-col gap-3 md:flex-row md:gap-8">
      <BigNumber
        label="Total Value Locked"
        :amount="{
          amount: '1732513.96',
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: ''
        }"
      />
      <BigNumber
        label="Buyback"
        :amount="{
          amount: '345775290',
          type: CURRENCY_VIEW_TYPES.TOKEN,
          denom: 'NLS',
          decimals: 2,
          hasSpace: true,
          fontSize: 20,
          fontSizeSmall: 20
        }"
      />
      <BigNumber
        label="Protocol Owned Liquidity"
        :amount="{
          amount: '11743183431',
          type: CURRENCY_VIEW_TYPES.TOKEN,
          denom: 'NLS',
          decimals: 2,
          hasSpace: true,
          fontSize: 20,
          fontSizeSmall: 20
        }"
      />
    </div>

    <SupplyBorrowedChart />
    <hr class="my-6 border-t border-border-color" />
    <LeasesMonthlyChart />
  </Widget>
</template>

<script lang="ts" setup>
import { Widget } from "web-components";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import BigNumber from "@/common/components/BigNumber.vue";

import SupplyBorrowedChart from "./SupplyBorrowedChart.vue";
import LeasesMonthlyChart from "@/modules/stats/components/LeasesMonthlyChart.vue";
</script>

<style scoped lang="scss"></style>
