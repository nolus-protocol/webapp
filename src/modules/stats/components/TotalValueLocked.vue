<template>
  <div class="shadow-field-normal mt-6 border border-border-color bg-neutral-bg-50 p-4 lg:rounded-xl lg:p-6">
    <div class="flex flex-col md:flex-row md:items-center md:justify-start">
      <div
        class="relative inline-block pb-4 after:absolute after:bottom-[12px] after:left-0 after:h-[1px] after:w-[calc(100vw-32px)] after:bg-border-color after:content-[''] md:after:h-0 md:after:w-0 lg:pb-0"
      >
        <p class="text-16 font-medium text-neutral-typography-200">
          {{ $t("message.total-value-locked") }}
        </p>
        <CurrencyComponent
          :amount="totalValueLocked"
          :decimals="2"
          :fontSize="40"
          :has-space="false"
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          class="font-semibold text-neutral-typography-200"
          denom="$"
        />
      </div>

      <div class="flex">
        <div class="flex-1 pt-3 sm:pl-3 md:flex-none md:pl-6">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.buyback") }}
          </p>

          <CurrencyComponent
            :amount="buybackTotal"
            :fontSize="20"
            :fontSizeSmall="16"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="NLS"
          />
        </div>
        <div class="flex-1 pt-3 sm:pl-3 md:flex-none md:pl-6 lg:ml-0">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            <!-- {{ $t('message.borrow-apr') }} -->
            {{ $t("message.incentives-pool") }}
          </p>
          <CurrencyComponent
            :amount="incentivesPool"
            :fontSize="20"
            :fontSizeSmall="16"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="NLS"
          />
        </div>
      </div>
    </div>

    <div
      class="border-t-none my-2 flex pt-2 md:border-t-[1px] md:border-border-color lg:border-b-0 lg:border-t lg:pt-4"
    >
      <div class="flex-1 pt-3 md:flex-none">
        <p class="flex text-12 font-medium text-neutral-400">
          {{ $t("message.supplied") }}
        </p>

        <span class="mb-[4px] mr-[4px] inline-flex h-[6px] w-[6px] rounded-full bg-[#2868E1]"> </span>
        <CurrencyComponent
          :amount="suppliedBorrowed.supplied"
          :fontSize="20"
          :fontSizeSmall="16"
          :has-space="false"
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          class="font-medium text-neutral-typography-200"
          denom="$"
        />
      </div>
      <div class="flex-1 pt-3 md:flex-none lg:ml-0 lg:pl-6">
        <p class="flex text-12 font-medium text-neutral-400">
          {{ $t("message.borrowed") }}
        </p>
        <span class="mb-[4px] mr-[4px] inline-flex h-[6px] w-[6px] rounded-full bg-[#FF562E]"> </span>
        <CurrencyComponent
          :amount="suppliedBorrowed.borrowed"
          :fontSize="20"
          :fontSizeSmall="16"
          :has-space="false"
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          class="font-medium text-neutral-typography-200"
          denom="$"
        />
      </div>
    </div>

    <div class="relative flex hidden lg:block">
      <StatLineChart
        ref="chartElement"
        :chart-data="chartData"
        @in-focus="inStatLineFocus"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import StatLineChart from "./StatLineChart.vue";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { EtlApi, Logger } from "@/common/utils";
import { useI18n } from "vue-i18n";

const i18n = useI18n();

const chartElement = ref<typeof StatLineChart>();
const totalValueLocked = ref("0");
const buybackTotal = ref("0");
const incentivesPool = ref("0");
const suppliedBorrowed = ref({
  supplied: "0",
  borrowed: "0"
});

const chartData = {
  datasets: [
    {
      label: i18n.t("message.supplied"),
      borderColor: "#2868E1",
      data: [],
      tension: 0.4,
      pointRadius: 0
    },
    {
      label: i18n.t("message.borrowed"),
      borderColor: "#FF562E",
      data: [],
      tension: 0.4,
      pointRadius: 0
    }
  ]
};

onMounted(async () => {
  await Promise.all([setTotalValueLocked(), setTimeSeries(), setBuyBackTotal(), setIncentivesPool()]).catch((e) =>
    Logger.error(e)
  );
});

function inStatLineFocus(data: string[], index: number) {
  if (index < 0) {
    return setLastIndex();
  }

  const [s, b] = chartElement.value!.getChartData().datasets;
  const [_s, svalue] = s.data[index];
  const [_b, bvalue] = b.data[index];
  suppliedBorrowed.value.supplied = svalue;
  suppliedBorrowed.value.borrowed = bvalue;
}

function setLastIndex() {
  const [s, b] = chartElement.value!.getChartData().datasets;
  const [_s, svalue] = s.data[0];
  const [_b, bvalue] = b.data[0];
  suppliedBorrowed.value.supplied = svalue;
  suppliedBorrowed.value.borrowed = bvalue;
}

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

async function setTimeSeries() {
  const data = await fetch(`${EtlApi.getApiUrl()}/time-series`);
  const items = await data.json();

  let dataBorrowed = [];
  let dataSupplied = [];

  for (const item of items) {
    dataSupplied.push([new Date(item.lp_pool_timestamp).getTime(), item.supplied]);

    dataBorrowed.push([new Date(item.lp_pool_timestamp).getTime(), item.borrowed]);
  }

  chartElement.value?.updateChart(dataSupplied, dataBorrowed);
  setLastIndex();
}
</script>

<style lang="scss" scoped></style>
