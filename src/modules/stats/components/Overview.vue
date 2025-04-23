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
          decimals: 0
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
          fontSizeSmall: 20
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
          fontSizeSmall: 20
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
          fontSizeSmall: 20,
          decimals: 0
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
          fontSizeSmall: 20
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
import { EtlApi, Logger } from "@/common/utils";
import { onMounted, ref } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";

const txVolume = ref("0");
const buybackTotal = ref("0");
const realized_pnl = ref("0");
const protocolRevenue = ref("0");
const tvl = ref("0");

const loading = ref(true);

onMounted(async () => {
  await Promise.all([setTVL(), setTxVolume(), setBuyBackTotal(), setRealizedPnl(), setProtocolRevenue()]).catch((e) =>
    Logger.error(e)
  );
  loading.value = false;
});

async function setTVL() {
  const data = await EtlApi.fetchTVL();
  tvl.value = data.total_value_locked;
}

async function setTxVolume() {
  const data = await EtlApi.fetchTxVolume();
  txVolume.value = data.total_tx_value;
}

async function setBuyBackTotal() {
  const data = await fetch(`${EtlApi.getApiUrl()}/buyback-total`);
  const item = await data.json();
  buybackTotal.value = item.buyback_total;
}

async function setRealizedPnl() {
  const data = await EtlApi.fetchRealizedPNLStats();
  realized_pnl.value = data.amount;
}

async function setProtocolRevenue() {
  const data = await fetch(`${EtlApi.getApiUrl()}/revenue`);
  const item = await data.json();
  protocolRevenue.value = item.revenue;
}
</script>
