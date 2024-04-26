<template>
  <div
    class="shadow-field-normal mt-6 flex max-w-[100%] flex-col border border-border-color bg-neutral-bg-50 md:flex-row lg:rounded-xl"
  >
    <!-- Rewards -->
    <div class="block flex-1 p-4 lg:p-6">
      <div class="flex items-center justify-between pb-0 pt-2">
        <h2 class="my-0 text-left text-16 font-medium text-neutral-typography-200">
          {{ $t("message.utilization-level") }}
        </h2>
      </div>
      <!-- Assets Container -->
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <!-- Ticker -->
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.osmosis") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelOsmosis"
                  :fontSize="28"
                  :fontSizeSmall="22"
                  :has-space="false"
                  :isDenomInfront="false"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="font-medium text-neutral-typography-200"
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
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
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
              class="font-medium text-neutral-typography-200"
              denom="%"
            />
          </div>
        </div>

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="20"
            :fontSizeSmall="16"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>

        <div class="pl-8 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.deposit-suspension") }}
            <Tooltip :content="$t('message.deposit-suspension-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="depositSuspension"
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
    </div>

    <div class="block flex-1 p-4 lg:p-6">
      <div class="hidden items-center justify-between px-4 pb-0 pt-2 md:flex">
        <h2 class="my-0 text-left text-16 font-medium text-neutral-typography-200">&nbsp;</h2>
      </div>
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.neutron") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelNeutron"
                  :fontSize="28"
                  :fontSizeSmall="22"
                  :has-space="false"
                  :isDenomInfront="false"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="font-medium text-neutral-typography-200"
                  denom="%"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="px- flex items-center justify-start py-4 md:px-6 lg:px-0">
        <div class="pt-3 lg:pl-4">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
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
              class="font-medium text-neutral-typography-200"
              denom="%"
            />
          </div>
        </div>

        <div class="pt-3 lg:pl-6">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="20"
            :fontSizeSmall="16"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>

        <div class="pl-8 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.deposit-suspension") }}
            <Tooltip :content="$t('message.deposit-suspension-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="depositSuspension"
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
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AppUtils, EtlApi, Logger } from "@/common/utils";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { Tooltip } from "web-components";
import { useApplicationStore } from "@/common/stores/application";

const utilizationLevelOsmosis = ref("0");
const utilizationLevelNeutron = ref("0");
const optimal = ref("70");
const depositSuspension = ref("65");
const app = useApplicationStore();

onMounted(async () => {
  await Promise.all([setUtilizationOsmosis(), setUtilizationNeutron()]).catch((e) => Logger.error(e));
});

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
</script>

<style lang="" scoped></style>
