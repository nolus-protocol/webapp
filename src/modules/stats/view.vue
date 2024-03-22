<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:px-0 lg:pt-[25px]">
      <div class="left w-full md:w-1/2">
        <h1 class="nls-font-700 nls-sm-title m-0 text-20 text-primary">
          {{ $t("message.stats") }}
        </h1>
      </div>
    </div>

    <div class="background shadow-box mt-6 p-4 outline lg:rounded-xl lg:p-6">
      <div class="assets-boxs flex flex-col md:flex-row md:items-center md:justify-start">
        <div class="left line-mobile inline-block pb-4 lg:pb-0">
          <p class="nls-font-500 text-16 text-primary">
            {{ $t("message.total-value-locked") }}
          </p>
          <CurrencyComponent
            :amount="totalValueLocked"
            :decimals="2"
            :fontSize="40"
            :has-space="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="nls-font-700 text-primary"
            denom="$"
          />
        </div>

        <div class="flex">
          <div class="flex-1 pt-3 sm:pl-3 md:flex-none md:pl-6">
            <p class="nls-font-500 text-dark-grey flex items-center text-12">
              {{ $t("message.buyback") }}
            </p>

            <CurrencyComponent
              :amount="buybackTotal"
              :fontSize="20"
              :fontSizeSmall="16"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="nls-font-500 text-primary"
              denom="NLS"
            />
          </div>
          <div class="flex-1 pt-3 sm:pl-3 md:flex-none md:pl-6 lg:ml-0">
            <p class="nls-font-500 text-dark-grey flex items-center text-12">
              <!-- {{ $t('message.borrow-apr') }} -->
              {{ $t("message.incentives-pool") }}
            </p>
            <CurrencyComponent
              :amount="incentivesPool"
              :fontSize="20"
              :fontSizeSmall="16"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="nls-font-500 text-primary"
              denom="NLS"
            />
          </div>
        </div>
      </div>

      <div class="border-standart my-2 flex pt-2 lg:border-b-0 lg:border-t lg:pt-4">
        <div class="flex-1 pt-3 md:flex-none">
          <p class="nls-font-500 text-dark-grey flex text-12">
            {{ $t("message.supplied") }}
          </p>

          <span class="mb-[4px] mr-[4px] inline-flex h-[6px] w-[6px] rounded-full bg-[#2868E1]"> </span>
          <CurrencyComponent
            :amount="suppliedBorrowed.supplied"
            :fontSize="20"
            :fontSizeSmall="16"
            :has-space="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="nls-font-500 text-primary"
            denom="$"
          />
        </div>
        <div class="flex-1 pt-3 md:flex-none lg:ml-0 lg:pl-6">
          <p class="nls-font-500 text-dark-grey flex text-12">
            {{ $t("message.borrowed") }}
          </p>
          <span class="mb-[4px] mr-[4px] inline-flex h-[6px] w-[6px] rounded-full bg-[#FF562E]"> </span>
          <CurrencyComponent
            :amount="suppliedBorrowed.borrowed"
            :fontSize="20"
            :fontSizeSmall="16"
            :has-space="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="nls-font-500 text-primary"
            denom="$"
          />
        </div>
      </div>

      <div class="relaltive flex hidden lg:block">
        <StatLineChart
          ref="chartElement"
          :chart-data="chartData"
          @in-focus="inStatLineFocus"
        />
      </div>
    </div>

    <div
      class="background border-standart shadow-box mt-6 flex max-w-[100%] flex-col outline md:flex-row lg:rounded-xl"
    >
      <!-- <div class="md:col-span-6 lg:co-span-6"> -->
      <!-- Rewards -->
      <div class="block flex-1 p-4 lg:p-6">
        <div class="flex items-center justify-between pb-0 pt-2">
          <h2 class="nls-font-500 my-0 text-left text-16 text-primary">
            {{ $t("message.utilization-level") }}
          </h2>
        </div>
        <!-- Assets Container -->
        <div class="border-standart block border-b">
          <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
            <!-- Ticker -->
            <div class="col-span-2 inline-flex items-center">
              <div class="inline-block">
                <div class="pt-3">
                  <p class="nls-font-500 text-dark-grey flex text-12">
                    {{ $t("message.osmosis") }}
                  </p>

                  <CurrencyComponent
                    :amount="utilizationLevelOsmosis"
                    :fontSize="28"
                    :fontSizeSmall="22"
                    :has-space="false"
                    :isDenomInfront="false"
                    :type="CURRENCY_VIEW_TYPES.CURRENCY"
                    class="nls-font-500 text-primary"
                    denom="%"
                  />
                </div>
              </div>
            </div>
          </div>
          <!-- Assets Container -->
        </div>

        <div class="px- flex items-center justify-start py-4 md:px-6 lg:px-0">
          <div class="pt-3">
            <p class="nls-font-500 text-dark-grey flex text-12">
              {{ $t("message.yield") }}
              <TooltipComponent :content="$t('message.yield-tooltip')" />
            </p>

            <div class="flex items-end">
              <img
                class="mr-[6px]"
                src="@/assets/icons/osmosis-usdc.svg"
              />
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().osmosis] ?? 0).toString()"
                :fontSize="20"
                :fontSizeSmall="16"
                :has-space="false"
                :isDenomInfront="false"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="nls-font-500 text-primary"
                denom="%"
              />
            </div>
          </div>

          <div class="pl-6 pt-3">
            <p class="nls-font-500 text-dark-grey flex text-12">
              {{ $t("message.optimal") }}
              <TooltipComponent :content="$t('message.optimal-tooltip')" />
            </p>

            <CurrencyComponent
              :amount="optimal"
              :fontSize="20"
              :fontSizeSmall="16"
              :has-space="false"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="nls-font-500 text-primary"
              denom="%"
            />
          </div>

          <div class="pl-8 pt-3">
            <p class="nls-font-500 text-dark-grey flex text-12">
              {{ $t("message.deposit-suspension") }}
              <TooltipComponent :content="$t('message.deposit-suspension-tooltip')" />
            </p>

            <CurrencyComponent
              :amount="depositSuspension"
              :fontSize="20"
              :fontSizeSmall="16"
              :has-space="false"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="nls-font-500 text-primary"
              denom="%"
            />
          </div>
        </div>
      </div>

      <div class="block flex-1 p-4 lg:p-6">
        <div class="hidden items-center justify-between px-4 pb-0 pt-2 md:flex">
          <h2 class="nls-font-500 my-0 text-left text-16 text-primary">&nbsp;</h2>
        </div>
        <div class="border-standart block border-b">
          <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
            <div class="col-span-2 inline-flex items-center">
              <div class="inline-block">
                <div class="pt-3">
                  <p class="nls-font-500 text-dark-grey flex text-12">
                    {{ $t("message.neutron") }}
                  </p>

                  <CurrencyComponent
                    :amount="utilizationLevelNeutron"
                    :fontSize="28"
                    :fontSizeSmall="22"
                    :has-space="false"
                    :isDenomInfront="false"
                    :type="CURRENCY_VIEW_TYPES.CURRENCY"
                    class="nls-font-500 text-primary"
                    denom="%"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="px- flex items-center justify-start py-4 md:px-6 lg:px-0">
          <div class="pt-3 lg:pl-4">
            <p class="nls-font-500 text-dark-grey flex text-12">
              {{ $t("message.yield") }}
              <TooltipComponent :content="$t('message.yield-tooltip')" />
            </p>

            <div class="flex items-end">
              <img
                class="mr-[6px]"
                src="@/assets/icons/neutron-usdc.svg"
              />
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().neutron] ?? 0).toString()"
                :fontSize="20"
                :fontSizeSmall="16"
                :has-space="false"
                :isDenomInfront="false"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="nls-font-500 text-primary"
                denom="%"
              />
            </div>
          </div>

          <div class="pt-3 lg:pl-6">
            <p class="nls-font-500 text-dark-grey flex text-12">
              {{ $t("message.optimal") }}
              <TooltipComponent :content="$t('message.optimal-tooltip')" />
            </p>

            <CurrencyComponent
              :amount="optimal"
              :fontSize="20"
              :fontSizeSmall="16"
              :has-space="false"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="nls-font-500 text-primary"
              denom="%"
            />
          </div>

          <div class="pl-8 pt-3">
            <p class="nls-font-500 text-dark-grey flex text-12">
              {{ $t("message.deposit-suspension") }}
              <TooltipComponent :content="$t('message.deposit-suspension-tooltip')" />
            </p>

            <CurrencyComponent
              :amount="depositSuspension"
              :fontSize="20"
              :fontSizeSmall="16"
              :has-space="false"
              :isDenomInfront="false"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="nls-font-500 text-primary"
              denom="%"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="background shadow-box mt-6 flex flex-col p-4 outline lg:flex-row lg:rounded-xl lg:p-6">
      <div class="w-full">
        <p class="nls-font-500 text-16 text-primary">
          {{ $t("message.leased-assets-total") }}
        </p>
        <div class="flex w-full flex-col items-center gap-4 lg:flex-row lg:gap-6">
          <div
            v-show="(loans?.length ?? 0) > 0"
            class="stats flex"
          >
            <StatDoughnutChart
              ref="statChart"
              @in-focus="inFocus"
            />
          </div>
          <div class="flex w-full flex-col gap-4 lg:flex-row lg:gap-6">
            <div class="flex flex-wrap gap-4 pt-6 xl:gap-6">
              <div
                v-for="(item, index) in loans"
                :key="index"
              >
                <p class="nls-font-500 text-dark-grey flex text-12">
                  {{ item.name }}
                </p>

                <CurrencyComponent
                  :amount="item.loan.toString()"
                  :class="{ 'loan-active': focus.includes(item.name) }"
                  :fontSize="20"
                  :fontSizeSmall="16"
                  :has-space="false"
                  :isDenomInfront="false"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                  denom="%"
                />
              </div>
            </div>

            <div
              class="border-standart flex border-t pl-0 lg:mr-6 lg:flex-col lg:items-start lg:justify-start lg:border-l lg:border-t-0 lg:pl-6"
            >
              <div class="pt-3 lg:pt-0">
                <p class="nls-font-500 text-dark-grey flex text-12">
                  {{ $t("message.borrowed") }}
                </p>

                <CurrencyComponent
                  :amount="totalBorrowed"
                  :fontSize="20"
                  :fontSizeSmall="16"
                  :has-space="false"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                  denom="$"
                />
              </div>
              <div class="ml-6 pt-3 lg:ml-0">
                <p class="nls-font-500 text-dark-grey flex text-12">
                  {{ $t("message.protocol-revenue") }}
                </p>

                <CurrencyComponent
                  :amount="protocolRevenue"
                  :fontSize="20"
                  :fontSizeSmall="16"
                  :has-space="false"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                  denom="$"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
div.stats {
  width: 190px;
  height: 190px;
  margin-top: 12px;
  position: relative;
  z-index: 0;
}

@media (max-width: 680px) {
  div.stats {
    margin-top: 24px;
    width: 320px !important;
    height: 320px !important;
  }
}

.assets-box {
  div:first-of-type {
    margin-bottom: 0px !important;
  }
}
</style>

<script lang="ts" setup>
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";
import StatLineChart from "@/modules/stats/components/StatLineChart.vue";
import StatDoughnutChart from "@/modules/stats/components/StatDoughnutChart.vue";

import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils, EtlApi, Logger, StringUtils } from "@/common/utils";
import { AppUtils } from "@/common/utils";

const i18n = useI18n();
const totalValueLocked = ref("0");
const utilizationLevelOsmosis = ref("0");
const utilizationLevelNeutron = ref("0");

const optimal = ref("70");
const depositSuspension = ref("65");
const totalBorrowed = ref("0");
const protocolRevenue = ref("0");
const buybackTotal = ref("0");
const incentivesPool = ref("0");

const chartElement = ref<typeof StatLineChart>();
const statChart = ref<typeof StatDoughnutChart>();
const loans = ref<{ loan: number; name: string }[]>();
const app = useApplicationStore();
const focus = ref<string[]>([]);
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
  await Promise.all([
    setTotalValueLocked(),
    setTimeSeries(),
    setUtilizationOsmosis(),
    setUtilizationNeutron(),
    setTotalBorrowed(),
    setProtocolRevenue(),
    setStats(),
    setBuyBackTotal(),
    setIncentivesPool()
  ]).catch((e) => Logger.error(e));
});

function inFocus(data: string[]) {
  focus.value = data;
}

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

async function setUtilizationOsmosis() {
  const data = await fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis}`);
  const item = await data.json();
  utilizationLevelOsmosis.value = item[0];
}

async function setUtilizationNeutron() {
  const data = await fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().neutron}`);
  const item = await data.json();
  utilizationLevelNeutron.value = item[0];
}

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

async function setStats() {
  const data = await fetch(`${EtlApi.getApiUrl()}/leased-assets`);
  const items: { loan: string; asset: string }[] = await data.json();
  const labels = [];
  const colors = [];
  const dataValue = [];
  let total = 0;
  console.log(items);
  for (const i of items) {
    const currency = AssetUtils.getCurrencyByTicker(i.asset);
    console.log(currency);
    labels.push(currency?.shortName ?? i.asset);
    dataValue.push(i.loan);
    colors.push(StringUtils.strToColor(currency?.shortName ?? i.asset));
    total += Number(i.loan);
  }

  loans.value = items
    .map((item) => {
      const currency = AssetUtils.getCurrencyByTicker(item.asset);

      const loan = (Number(item.loan) / total) * 100;
      return {
        name: currency?.shortName ?? item.asset,
        loan: loan
      };
    })
    .sort((a, b) => {
      return b.loan - a.loan;
    });

  statChart.value?.updateChart(labels, colors, dataValue);
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
</script>
