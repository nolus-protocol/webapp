<template>
  <div class="col-span-12 mb-sm-nolus-70 max-w-[880px]">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-2 lg:pt-[25px] lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          {{ $t("message.stats") }}
        </h1>
      </div>
    </div>

    <div class="background mt-6 shadow-box radius-medium radius-0-sm pt-6 pb-3 outline">
      <div class="balance-box flex px-6 items-center justify-start">
        <div class="left inline-block line-mobile pb-4 md:pb-0">
          <p class="nls-font-500 text-16 text-primary">
            {{ $t('message.total-value-locked') }}
          </p>
          <CurrencyComponent :fontSize="40"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="totalValueLocked"
                             denom="$"
                             :has-space="false"
                             :decimals="2"
                             class="nls-font-700 text-primary" />
        </div>

        <div class="pt-3 lg:pl-6">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            {{ $t('message.yield') }}
            <TooltipComponent :content="$t('message.yield-tooltip')" />
          </p>

          <CurrencyComponent :fontSize="20"
                             :fontSizeSmall="16"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="yieldValue"
                             denom="%"
                             :isDenomInfront="false"
                             :has-space="false"
                             class="nls-font-500 text-primary" />
        </div>

        <div class="pt-3 lg:pl-6">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            {{ $t('message.borrow-apr') }}
          </p>

          <CurrencyComponent :fontSize="20"
                             :fontSizeSmall="16"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="borrowApr"
                             denom="%"
                             :isDenomInfront="false"
                             :has-space="false"
                             class="nls-font-500 text-primary" />
        </div>
      </div>

      <div class="border-standart border-t lg:border-b-0 px-6 my-2 pt-4 flex">
        <div class="pt-3">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            {{ $t('message.supplied') }}
          </p>

          <CurrencyComponent :fontSize="20"
                             :fontSizeSmall="16"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="supplied"
                             denom="$"
                             :has-space="false"
                             class="nls-font-500 text-primary" />
        </div>
        <div class="pt-3 lg:pl-6">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            {{ $t('message.borrowed') }}
          </p>

          <CurrencyComponent :fontSize="20"
                             :fontSizeSmall="16"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="borrowed"
                             denom="$"
                             :has-space="false"
                             class="nls-font-500 text-primary" />
        </div>
      </div>

      <div class="flex relaltive p-6">
        <PriceHistoryChart ref="chartElement"
                           :chart-data="chartData" />
      </div>

    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-6 lg:co-span-6">
        <!-- Rewards -->
        <div
             class="block order-2 md:order-1 background md:col-span-7 mt-6 outline border-standart shadow-box radius-medium radius-0-sm">
          <div class="flex items-center justify-between px-6 pt-6 pb-0">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              {{ $t('message.utilization-level') }}
            </h2>
          </div>
          <!-- Assets Container -->
          <div class="block border-b border-standart">
            <div class="grid gap-6px-3 md:px-6 py-2 items-center justify-between earn-asset grid-cols-3 md:grid-cols-3">
              <!-- Ticker -->
              <div class="inline-flex items-center col-span-2">
                <div class="inline-block">
                  <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
                    <CurrencyComponent :fontSize="28"
                                       :fontSizeSmall="18"
                                       :type="CURRENCY_VIEW_TYPES.CURRENCY"
                                       :amount="utilizationLevel"
                                       denom="%"
                                       :isDenomInfront="false"
                                       :has-space="false"
                                       class="nls-font-700 text-primary" />
                  </p>
                </div>
              </div>

            </div>
            <!-- Assets Container -->
          </div>
          <div class="flex items-center justify-start py-4">
            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                {{ $t('message.optimal') }}
                <TooltipComponent :content="$t('message.optimal-tooltip')" />
              </p>

              <CurrencyComponent :fontSize="20"
                                 :fontSizeSmall="16"
                                 :type="CURRENCY_VIEW_TYPES.CURRENCY"
                                 :amount="optimal"
                                 denom="%"
                                 :isDenomInfront="false"
                                 :has-space="false"
                                 class="nls-font-500 text-primary" />
            </div>

            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                {{ $t('message.deposit-suspension') }}
                <TooltipComponent :content="$t('message.deposit-suspension-tooltip')" />
              </p>

              <CurrencyComponent :fontSize="20"
                                 :fontSizeSmall="16"
                                 :type="CURRENCY_VIEW_TYPES.CURRENCY"
                                 :amount="depositSuspension"
                                 denom="%"
                                 :isDenomInfront="false"
                                 :has-space="false"
                                 class="nls-font-500 text-primary" />
            </div>
          </div>
        </div>
      </div>

      <div class="md:col-span-6 lg:co-span-6">
        <!-- Rewards -->
        <div
             class="block order-2 md:order-1 background md:col-span-7 mt-6 outline border-standart shadow-box radius-medium radius-0-sm">
          <div class="flex items-center justify-between px-6 pt-6 pb-0">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              {{ $t('message.buyback-total') }}
            </h2>
          </div>
          <!-- Assets Container -->
          <div class="block border-b border-standart">
            <div class="grid gap-6px-3 md:px-6 py-2 items-center justify-between earn-asset grid-cols-3 md:grid-cols-3">
              <!-- Ticker -->
              <div class="inline-flex items-center col-span-2">
                <div class="inline-block">
                  <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
                    <CurrencyComponent :fontSize="28"
                                       :fontSizeSmall="18"
                                       :type="CURRENCY_VIEW_TYPES.TOKEN"
                                       amount="777777777777"
                                       minimalDenom="unls"
                                       denom="NLS"
                                       :decimals="6"
                                       :maxDecimals="2"
                                       class="nls-font-700 text-primary" />
                  </p>
                </div>
              </div>

            </div>
            <!-- Assets Container -->
          </div>
          <div class="flex items-center justify-start py-4">
            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                {{ $t('message.incentives-pool') }}
              </p>

              <CurrencyComponent :fontSize="20"
                                 :fontSizeSmall="16"
                                 :type="CURRENCY_VIEW_TYPES.CURRENCY"
                                 amount="7777"
                                 denom="$"
                                 :has-space="false"
                                 class="nls-font-500 text-primary" />
            </div>

            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                {{ $t('message.distributed') }}
              </p>

              <CurrencyComponent :fontSize="20"
                                 :fontSizeSmall="16"
                                 :type="CURRENCY_VIEW_TYPES.CURRENCY"
                                 :amount="distributed"
                                 denom="$"
                                 :has-space="false"
                                 class="nls-font-500 text-primary" />
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="background mt-6 shadow-box radius-medium radius-0-sm outline flex">
      <div class="pt-6 pl-6 pb-6">
        <p class="nls-font-500 text-16 text-primary">
          {{ $t('message.leased-assets-total') }}
        </p>
        <div class="flex">
          <div class="stats flex">
            <StatChart ref="statChart"
                       @in-focus="inFocus" />
          </div>
          <div class="flex flex-wrap my-4">

            <div v-for="item in loans"
                 class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                {{ item.name }}
              </p>

              <CurrencyComponent :fontSize="20"
                                 :fontSizeSmall="16"
                                 :type="CURRENCY_VIEW_TYPES.CURRENCY"
                                 :amount="item.loan"
                                 denom="%"
                                 :isDenomInfront="false"
                                 :has-space="false"
                                 class="nls-font-500 text-primary"
                                 :class="{ 'loan-active': focus.includes(item.name) }" />
            </div>

          </div>
        </div>
      </div>

      <div class="border-standart border-l lg:border-b-0 px-14 flex items-start justify-center flex-col mr-6">
        <div class="pt-3">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            {{ $t('message.borrowed') }}
          </p>

          <CurrencyComponent :fontSize="20"
                             :fontSizeSmall="16"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="totalBorrowed"
                             denom="$"
                             :has-space="false"
                             class="nls-font-500 text-primary" />
        </div>
        <div class="pt-3">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            {{ $t('message.protocol-revenue') }}
          </p>

          <CurrencyComponent :fontSize="20"
                             :fontSizeSmall="16"
                             :type="CURRENCY_VIEW_TYPES.CURRENCY"
                             :amount="protocolRevenue"
                             denom="$"
                             :has-space="false"
                             class="nls-font-500 text-primary" />
        </div>
      </div>
    </div>

  </div>
</template>

<style lang="scss">
div.stats {
  width: 160px;
  height: 160px;
  margin-top: 12px;
}
</style>

<script setup lang="ts">
import CurrencyComponent from '@/components/CurrencyComponent.vue';
import TooltipComponent from '@/components/TooltipComponent.vue';
import PriceHistoryChart from "@/components/templates/utils/NolusChart.vue";
import StatChart from '@/components/StatChart.vue';

import { CURRENCY_VIEW_TYPES } from '@/types/CurrencyViewType';
import { onMounted, ref } from 'vue';
import { ETL_API } from '@/config/env';
import { useI18n } from 'vue-i18n';
import { useWalletStore } from '@/stores/wallet';

const i18n = useI18n();
const totalValueLocked = ref('0');
const yieldValue = ref('0');
const borrowApr = ref('0');
const supplied = ref('0');
const borrowed = ref('0');
const utilizationLevel = ref('0');
const optimal = ref('70');
const depositSuspension = ref('50');
const distributed = ref('0');
const totalBorrowed = ref('0');
const protocolRevenue = ref('0');

const chartElement = ref<typeof PriceHistoryChart>();
const statChart = ref<typeof StatChart>();
const loans = ref<{ loan: string, name: string }[]>()
const focus = ref<string[]>([])

const wallet = useWalletStore();

const chartData = {
  datasets: [
    {
      label: i18n.t("message.supplied"),
      borderColor: "#2868E1",
      data: [

      ] as any,
      tension: 0.4,
      pointRadius: 0,
    },
    {
      label: i18n.t("message.borrowed"),
      borderColor: "#FF562E",
      data: [

      ] as any,
      tension: 0.4,
      pointRadius: 0,
    },
  ],
};

onMounted(async () => {
  await Promise.all([
    setTotalValueLocked(),
    setYield(),
    setBorrowApr(),
    setTimeSeries(),
    setUtilization(),
    setDistributed(),
    setTotalBorrowed(),
    setProtocolRevenue(),
    setStats()
  ])
});

function inFocus(data: string[]) {
  focus.value = data;
}

async function setTotalValueLocked() {
  const data = await fetch(`${ETL_API}/total-value-locked`);
  const item = await data.json();
  totalValueLocked.value = item.total_value_locked;
}

async function setYield() {
  const data = await fetch(`${ETL_API}/yield`);
  const item = await data.json();
  yieldValue.value = item.yield;
}

async function setBorrowApr() {
  const data = await fetch(`${ETL_API}/borrow-apr`);
  const item = await data.json();
  borrowApr.value = item[0];
}

async function setTimeSeries() {
  const data = await fetch(`${ETL_API}/time-series`);
  const items = await data.json();
  let borrowedValue = 0;
  let suppliedValue = 0;

  let dataBorrowed = [];
  let dataSupplied = [];

  for (const item of items) {
    borrowedValue += Number(item.borrowed);
    suppliedValue += Number(item.supplied);

    dataSupplied.push([
      new Date(item.lp_pool_timestamp).getTime(),
      item.supplied
    ]);

    dataBorrowed.push([
      new Date(item.lp_pool_timestamp).getTime(),
      item.borrowed
    ]);

  }

  supplied.value = suppliedValue.toString();
  borrowed.value = borrowedValue.toString();

  chartElement.value?.updateChart(dataSupplied, dataBorrowed);

}

async function setUtilization() {
  const data = await fetch(`${ETL_API}/utilization-level`);
  const item = await data.json();
  utilizationLevel.value = item[0];
}

async function setDistributed() {
  const data = await fetch(`${ETL_API}/distributed`);
  const item = await data.json();
  distributed.value = item.distributed;
}

async function setTotalBorrowed() {
  const data = await fetch(`${ETL_API}/borrowed`);
  const item = await data.json();
  totalBorrowed.value = item.borrowed;
}

async function setProtocolRevenue() {
  const data = await fetch(`${ETL_API}/revenue`);
  const item = await data.json();
  protocolRevenue.value = item.revenue;
}

async function setStats() {

  const data = await fetch(`${ETL_API}/leased-assets`);
  const items = await data.json();
  const labels = [];
  const colors = [];
  const dataValue = [];
  let total = 0;

  for (const i of items) {
    const currency = wallet.getCurrencyByTicker(i.asset);
    labels.push(currency?.shortName ?? i.asset);
    dataValue.push(i.loan);
    colors.push(strToColor(currency?.shortName ?? i.asset));
    total += Number(i.loan);
  }

  loans.value = items.map((item: { loan: string, asset: string }) => {
    const currency = wallet.getCurrencyByTicker(item.asset);

    const loan = (Number(item.loan) / total) * 100;
    return {
      name: currency?.shortName ?? item.asset,
      loan
    }
  });

  statChart.value?.updateChart(labels, colors, dataValue);

}

function strToColor(str: string) {
  var hash = 0;
  if (str.length === 0) return hash;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  var rgb = [0, 0, 0];
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 255;
    rgb[i] = value;
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

</script>