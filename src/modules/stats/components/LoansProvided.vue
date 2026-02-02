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
import { EtlApi, isMobile, Logger } from "@/common/utils";
import { ref, watch } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";

const loading = ref(true);
const openPositionValue = ref("0");
const openInterest = ref("0");
const app = useApplicationStore();

watch(
  () => app.init,
  () => {
    if (app.init) {
      onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  try {
    // Use batch endpoint - single request instead of 2 separate requests
    const data = await EtlApi.fetchLoansStatsBatch();

    if (data.open_position_value) {
      openPositionValue.value = data.open_position_value.open_position_value;
    }
    if (data.open_interest) {
      openInterest.value = data.open_interest.open_interest;
    }
  } catch (e) {
    Logger.error(e);
  }
  loading.value = false;
}
</script>
