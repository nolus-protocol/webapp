<template>
  <Widget>
    <WidgetHeader :label="$t('message.leased-assets-total')" />
    <div class="flex flex-col gap-4 md:flex-row md:gap-8">
      <BigNumber
        :label="$t('message.open-posiitons-value')"
        :amount="{
          amount: openPositionValue,
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
      <BigNumber
        :label="$t('message.open-interest')"
        :label-tooltip="{
          content: $t('message.open-interest-tooltip')
        }"
        :amount="{
          amount: openInterest,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
      <BigNumber
        :label="$t('message.unrealized-pnl')"
        :label-tooltip="{
          content: $t('message.unrealized-pnl-tooltip')
        }"
        :amount="{
          amount: unraelizedPnl,
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
const openPositionValue = ref("0");
const openInterest = ref("0");
const unraelizedPnl = ref("0");

onMounted(async () => {
  await Promise.all([setTotalBorrowed(), setOpenPositonsValue(), setOpenInterest(), setUnrealizedPnl()]).catch((e) =>
    Logger.error(e)
  );
});

async function setTotalBorrowed() {
  const data = await fetch(`${EtlApi.getApiUrl()}/borrowed`);
  const item = await data.json();
  totalBorrowed.value = item.borrowed;
}

async function setOpenPositonsValue() {
  const data = await EtlApi.fetchOpenPositionValue();
  openPositionValue.value = data.open_position_value;
}

async function setOpenInterest() {
  const data = await EtlApi.fetchOpenInterest();
  openInterest.value = data.open_interest;
}

async function setUnrealizedPnl() {
  const data = await EtlApi.fetchUnrealizedPnl();
  unraelizedPnl.value = data.unrealized_pnl;
}
</script>
