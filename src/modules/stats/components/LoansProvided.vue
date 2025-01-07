<template>
  <Widget>
    <WidgetHeader :label="$t('message.leased-assets-total')" />
    <div class="flex flex-col gap-4 md:flex-row md:gap-8">
      <BigNumber
        label="Protocol Revenue"
        :amount="{
          amount: '108619.33',
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: '$'
        }"
      />
      <BigNumber
        label="Borrow"
        :amount="{
          amount: '14091616.25',
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: '$'
        }"
      />
    </div>
    <LoansChart />
  </Widget>
</template>

<script lang="ts" setup>
import { Widget } from "web-components";

import { CURRENCY_VIEW_TYPES } from "@/common/types";

import BigNumber from "@/common/components/BigNumber.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import LoansChart from "@/modules/stats/components/LoansChart.vue";
</script>

<style lang="scss" scoped></style>
