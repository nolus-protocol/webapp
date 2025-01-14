<template>
  <Widget>
    <WidgetHeader :label="$t('message.leased-assets-total')" />
    <div class="flex flex-col gap-4 md:flex-row md:gap-8">
      <BigNumber
        :label="$t('message.protocol-revenue')"
        :amount="{
          amount: protocolRevenue,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
      <BigNumber
        :label="$t('message.borrowed')"
        :amount="{
          amount: totalBorrowed,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
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
import { Logger, EtlApi } from "@/common/utils";
import { ref, onMounted } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";

const totalBorrowed = ref("0");
const protocolRevenue = ref("0");

onMounted(async () => {
  await Promise.all([setTotalBorrowed(), setProtocolRevenue()]).catch((e) => Logger.error(e));
});

async function setTotalBorrowed() {
  const data = await fetch(`${EtlApi.getApiUrl()}/borrowed`);
  const item = await data.json();
  totalBorrowed.value = item.borrowed;
}

async function setProtocolRevenue() {
  const data = await fetch(`${EtlApi.getApiUrl()}/revenue`);
  const item = await data.json();
  protocolRevenue.value = item.revenue;
}
</script>
