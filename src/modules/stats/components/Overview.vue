<template>
  <Widget>
    <WidgetHeader :label="$t('message.overview')" />
    <div class="flex flex-col gap-3 md:flex-row md:gap-8">
      <BigNumber
        :label="$t('message.total-value-locked')"
        :amount="{
          amount: totalValueLocked,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
      <BigNumber
        :label="$t('message.protocol-revenue')"
        :amount="{
          amount: protocolRevenue,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: 20,
          fontSizeSmall: 20
        }"
      />
      <BigNumber
        :label="$t('message.buyback')"
        :amount="{
          amount: buybackTotal,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_ASSET.label,
          decimals: 2,
          hasSpace: true,
          isDenomInfront: false,
          fontSize: 20,
          fontSizeSmall: 20
        }"
      />
      <BigNumber
        :label="$t('message.incentives-pool')"
        :amount="{
          amount: incentivesPool,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_ASSET.label,
          decimals: 2,
          hasSpace: true,
          isDenomInfront: false,
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
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import SupplyBorrowedChart from "./SupplyBorrowedChart.vue";
import LeasesMonthlyChart from "@/modules/stats/components/LeasesMonthlyChart.vue";

import { Widget } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { EtlApi, Logger } from "@/common/utils";
import { onMounted, ref } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";

const totalValueLocked = ref("0");
const buybackTotal = ref("0");
const incentivesPool = ref("0");
const protocolRevenue = ref("0");

onMounted(async () => {
  await Promise.all([setTotalValueLocked(), setBuyBackTotal(), setIncentivesPool(), setProtocolRevenue()]).catch((e) =>
    Logger.error(e)
  );
});

async function setTotalValueLocked() {
  const data = await fetch(`${EtlApi.getApiUrl()}/total-value-locked`);
  const item = await data.json();
  totalValueLocked.value = item.total_value_locked;
}

async function setBuyBackTotal() {
  const data = await fetch(`${EtlApi.getApiUrl()}/buyback-total`);
  const item = await data.json();
  buybackTotal.value = item.buyback_total;
}

async function setIncentivesPool() {
  const data = await fetch(`${EtlApi.getApiUrl()}/incentives-pool`);
  const item = await data.json();
  incentivesPool.value = item.incentives_pool;
}

async function setProtocolRevenue() {
  const data = await fetch(`${EtlApi.getApiUrl()}/revenue`);
  const item = await data.json();
  protocolRevenue.value = item.revenue;
}
</script>
