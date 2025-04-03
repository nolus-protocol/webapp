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
          decimals: 0
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
          fontSizeSmall: 20,
          decimals: 0
        }"
        :loading="loading"
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
import { EtlApi, Logger } from "@/common/utils";
import { onMounted, ref } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";

const loading = ref(true);
const openPositionValue = ref("0");
const openInterest = ref("0");

onMounted(async () => {
  await Promise.all([setOpenPositonsValue(), setOpenInterest()]).catch((e) => Logger.error(e));
});

async function setOpenPositonsValue() {
  const data = await EtlApi.fetchOpenPositionValue();
  openPositionValue.value = data.open_position_value;
  loading.value = false;
}

async function setOpenInterest() {
  const data = await EtlApi.fetchOpenInterest();
  openInterest.value = data.open_interest;
  loading.value = false;
}
</script>
