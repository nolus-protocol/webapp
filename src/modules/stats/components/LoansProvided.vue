<template>
  <div
    class="shadow-field-normal mt-6 flex flex-col border border-border-color bg-neutral-bg-50 p-4 lg:flex-row lg:rounded-xl lg:p-6"
  >
    <div class="w-full">
      <p class="text-16 font-medium text-neutral-typography-200">
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
              <p class="flex text-12 font-medium text-neutral-400">
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
                class="font-medium text-neutral-typography-200"
                denom="%"
              />
            </div>
          </div>

          <div
            class="flex border-t border-border-color pl-0 lg:mr-6 lg:flex-col lg:items-start lg:justify-start lg:border-l lg:border-t-0 lg:pl-6"
          >
            <div class="pt-3 lg:pt-0">
              <p class="flex text-12 font-medium text-neutral-400">
                {{ $t("message.borrowed") }}
              </p>

              <CurrencyComponent
                :amount="totalBorrowed"
                :fontSize="20"
                :fontSizeSmall="16"
                :has-space="false"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
                denom="$"
              />
            </div>
            <div class="ml-6 pt-3 lg:ml-0">
              <p class="flex text-12 font-medium text-neutral-400">
                {{ $t("message.protocol-revenue") }}
              </p>

              <CurrencyComponent
                :amount="protocolRevenue"
                :fontSize="20"
                :fontSizeSmall="16"
                :has-space="false"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
                denom="$"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import StatDoughnutChart from "@/modules/stats/components/StatDoughnutChart.vue";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { onMounted, ref } from "vue";
import { AssetUtils, EtlApi, Logger, StringUtils } from "@/common/utils";

const statChart = ref<typeof StatDoughnutChart>();
const totalBorrowed = ref("0");
const protocolRevenue = ref("0");
const loans = ref<{ loan: number; name: string }[]>();
const focus = ref<string[]>([]);

onMounted(async () => {
  await Promise.all([setTotalBorrowed(), setProtocolRevenue(), setStats()]).catch((e) => Logger.error(e));
});

function inFocus(data: string[]) {
  focus.value = data;
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

  for (const i of items) {
    const currency = AssetUtils.getCurrencyByTicker(i.asset);
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
</script>

<style lang="scss" scoped>
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
</style>
