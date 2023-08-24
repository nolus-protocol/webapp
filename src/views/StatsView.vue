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
            Total value locked
          </p>
          <CurrencyComponent
            :fontSize="40"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="408423"
            denom="$"
            :has-space="false"
            :decimals="2"
            class="nls-font-700 text-primary"
          />
        </div>

        <div class="pt-3 lg:pl-6">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            Yield
            <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
          </p>

          <CurrencyComponent
            :fontSize="20"
            :fontSizeSmall="16"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="4.22"
            denom="%"
            :isDenomInfront="false"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
        </div>

        <div class="pt-3 lg:pl-6">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            Borrow APR
          </p>

          <CurrencyComponent
            :fontSize="20"
            :fontSizeSmall="16"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="14"
            denom="%"
            :isDenomInfront="false"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
        </div>
      </div>

      <div class="border-standart border-t lg:border-b-0 px-6 my-2 pt-4 flex">
        <div class="pt-3">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            Supplied
          </p>

          <CurrencyComponent
            :fontSize="20"
            :fontSizeSmall="16"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="220234"
            denom="$"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
        </div>
        <div class="pt-3 lg:pl-6">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            Borrowed
          </p>

          <CurrencyComponent
            :fontSize="20"
            :fontSizeSmall="16"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="14"
            denom="$"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
        </div>
      </div>

      <div class="flex relaltive p-6">
        <PriceHistoryChart :chartData="chartData" />
      </div>

    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-6 lg:co-span-6">
        <!-- Rewards -->
        <div
          class="block order-2 md:order-1 background md:col-span-7 mt-6 outline border-standart shadow-box radius-medium radius-0-sm"
        >
          <div class="flex items-center justify-between px-6 pt-6 pb-0">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              Utilization level
            </h2>
          </div>
          <!-- Assets Container -->
          <div class="block border-b border-standart">
            <div class="grid gap-6px-3 md:px-6 py-2 items-center justify-between earn-asset grid-cols-3 md:grid-cols-3">
              <!-- Ticker -->
              <div class="inline-flex items-center col-span-2">
                <div class="inline-block">
                  <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
                    <CurrencyComponent
                      :fontSize="28"
                      :fontSizeSmall="18"
                      :type="CURRENCY_VIEW_TYPES.CURRENCY"
                      amount="23.54"
                      denom="%"
                      :isDenomInfront="false"
                      :has-space="false"
                      class="nls-font-700 text-primary"
                    />
                  </p>
                </div>
              </div>

            </div>
            <!-- Assets Container -->
          </div>
          <div class="flex items-center justify-start py-4">
            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                Optimal
                <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="70"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>

            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                Deposit Suspension
                <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="45"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="md:col-span-6 lg:co-span-6">
        <!-- Rewards -->
        <div
          class="block order-2 md:order-1 background md:col-span-7 mt-6 outline border-standart shadow-box radius-medium radius-0-sm"
        >
          <div class="flex items-center justify-between px-6 pt-6 pb-0">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              Buyback (Total)
            </h2>
          </div>
          <!-- Assets Container -->
          <div class="block border-b border-standart">
            <div class="grid gap-6px-3 md:px-6 py-2 items-center justify-between earn-asset grid-cols-3 md:grid-cols-3">
              <!-- Ticker -->
              <div class="inline-flex items-center col-span-2">
                <div class="inline-block">
                  <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
                    <CurrencyComponent
                      :fontSize="28"
                      :fontSizeSmall="18"
                      :type="CURRENCY_VIEW_TYPES.TOKEN"
                      amount="681000000"
                      minimalDenom="unls"
                      denom="NLS"
                      :decimals="6"
                      :maxDecimals="2"
                      class="nls-font-700 text-primary"
                    />
                  </p>
                </div>
              </div>

            </div>
            <!-- Assets Container -->
          </div>
          <div class="flex items-center justify-start py-4">
            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                Incentives Pool
                <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="70"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>

            <div class="pt-3 lg:pl-6">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                Distributed
                <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="45"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="background mt-6 shadow-box radius-medium radius-0-sm outline flex">
      <div class="pt-6 pl-6 pb-6">
        <p class="nls-font-500 text-16 text-primary">
          Leased Assets (Total)
        </p>
        <div class="flex">
          <div class="stats flex">
            <StatChart />
          </div>
          <div class="flex flex-wrap my-4">
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
            <div class="lg:pl-6 self-center">
              <p class="nls-font-500 text-12 text-dark-grey flex">
                BTC
              </p>

              <CurrencyComponent
                :fontSize="20"
                :fontSizeSmall="16"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                amount="4.22"
                denom="%"
                :isDenomInfront="false"
                :has-space="false"
                class="nls-font-500 text-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="border-standart border-l lg:border-b-0 px-14 flex items-start justify-center flex-col mr-6">
        <div class="pt-3">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            Supplied
          </p>

          <CurrencyComponent
            :fontSize="20"
            :fontSizeSmall="16"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="220234"
            denom="$"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
        </div>
        <div class="pt-3">
          <p class="nls-font-500 text-12 text-dark-grey flex">
            Borrowed
          </p>

          <CurrencyComponent
            :fontSize="20"
            :fontSizeSmall="16"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            amount="14"
            denom="$"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
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

const chartData = {
  datasets: [
    {
      label: 'LABEL',
      borderColor: "#2868E1",
      data: [
        [1692733256659, 7.267618722262804],
        [1692733532784, 7.268451288499447],
        [1692733810982, 7.2680101573829985],
        [1692734108704, 7.26355389720499],
        [1692734408218, 7.254592667438157],
        [1692734760864, 7.263621236955975],
        [1692735041906, 7.273481249820382]
      ] as any,
      tension: 0.4,
      pointRadius: 0,
    },
    {
      label: 'LABEL2',
      borderColor: "#FF562E",
      data: [
        [1692733256659, 8.267618722262804],
        [1692733532784, 6.268451288499447],
        [1692733810982, 7.2680101573829985],
        [1692734108704, 6.26355389720499],
        [1692734408218, 6.254592667438157],
        [1692734760864, 6.263621236955975],
        [1692735041906, 7.273481249820382]
      ] as any,
      tension: 0.4,
      pointRadius: 0,
    },
  ],
};

</script>