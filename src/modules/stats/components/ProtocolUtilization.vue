<template>
  <div
    class="mt-6 flex max-w-[100%] flex-col gap-6 border border-border-color bg-neutral-bg-50 p-4 shadow-field-normal md:flex-row lg:flex-wrap lg:rounded-xl lg:p-6"
  >
    <!-- Rewards -->
    <div class="lg:w-[calc(50%-1.5rem)]">
      <div class="flex items-center justify-between pb-0 pt-2">
        <h2 class="my-0 text-left text-16 font-medium text-neutral-typography-200">
          {{ $t("message.utilization-level") }}
        </h2>
      </div>
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.osmosis-noble") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelOsmosis"
                  :fontSize="40"
                  :fontSizeSmall="32"
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
      <div class="flex items-center justify-between px-0 pt-4 md:justify-start">
        <div class="pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
          </p>

          <div class="flex items-center">
            <img
              class="mr-[6px]"
              src="@/assets/icons/osmosis-usdc.svg"
            />
            <div>
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().osmosis_noble] ?? 0).toString()"
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

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="16"
            :fontSizeSmall="12"
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
            :fontSize="16"
            :fontSizeSmall="12"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>
      </div>
    </div>
    <div class="lg:w-[calc(50%-1.5rem)]">
      <div class="hidden items-center justify-between px-4 pb-0 pt-2 md:flex">
        <h2 class="my-0 text-left text-16 font-medium text-neutral-typography-200">&nbsp;</h2>
      </div>
      <!-- Assets Container -->
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <!-- Ticker -->
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.neutron") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelNeutron"
                  :fontSize="40"
                  :fontSizeSmall="32"
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
      <div class="flex items-center justify-between px-0 pt-4 md:justify-start">
        <div class="pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
          </p>

          <div class="flex items-center">
            <img
              class="mr-[6px]"
              src="@/assets/icons/neutron-usdc.svg"
            />
            <div>
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().neutron_noble] ?? 0).toString()"
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

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="16"
            :fontSizeSmall="12"
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
            :fontSize="16"
            :fontSizeSmall="12"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>
      </div>
    </div>

    <div class="lg:w-[calc(50%-1.5rem)]">
      <!-- Assets Container -->
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <!-- Ticker -->
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.osmosis-allbtc") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelOsmosisAllBtc"
                  :fontSize="40"
                  :fontSizeSmall="32"
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
      <div class="flex items-center justify-between px-0 pt-4 md:justify-start">
        <div class="pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
          </p>

          <div class="flex items-center">
            <img
              class="mr-[6px]"
              src="@/assets/icons/osmosis-allbtc.svg"
            />
            <div>
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_all_btc] ?? 0).toString()"
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

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="16"
            :fontSizeSmall="12"
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
            :fontSize="16"
            :fontSizeSmall="12"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>
      </div>
    </div>

    <div class="lg:w-[calc(50%-1.5rem)]">
      <!-- Assets Container -->
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <!-- Ticker -->
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.osmosis-allsol") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelOsmosisAllSol"
                  :fontSize="40"
                  :fontSizeSmall="32"
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
      <div class="flex items-center justify-between px-0 pt-4 md:justify-start">
        <div class="pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
          </p>

          <div class="flex items-center">
            <img
              class="mr-[6px]"
              src="@/assets/icons/osmosis-allsol.svg"
            />
            <div>
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_all_sol] ?? 0).toString()"
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

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="16"
            :fontSizeSmall="12"
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
            :fontSize="16"
            :fontSizeSmall="12"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>
      </div>
    </div>

    <div class="lg:w-[calc(50%-1.5rem)]">
      <!-- Assets Container -->
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <!-- Ticker -->
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.osmosis-st-atom") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelOsmosisStAtom"
                  :fontSize="40"
                  :fontSizeSmall="32"
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
      <div class="flex items-center justify-between px-0 pt-4 md:justify-start">
        <div class="pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
          </p>

          <div class="flex items-center">
            <img
              class="mr-[6px]"
              src="@/assets/icons/osmosis-statom.svg"
            />
            <div>
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_st_atom] ?? 0).toString()"
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

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="16"
            :fontSizeSmall="12"
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
            :fontSize="16"
            :fontSizeSmall="12"
            :has-space="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="font-medium text-neutral-typography-200"
            denom="%"
          />
        </div>
      </div>
    </div>

    <div class="lg:w-[calc(50%-1.5rem)]">
      <!-- Assets Container -->
      <div class="block border-b border-border-color">
        <div class="gap-6px-3 earn-asset grid grid-cols-3 items-center justify-between py-2 md:grid-cols-3">
          <!-- Ticker -->
          <div class="col-span-2 inline-flex items-center">
            <div class="inline-block">
              <div class="pt-3">
                <p class="flex text-12 font-medium text-neutral-400">
                  {{ $t("message.osmosis-akt") }}
                </p>

                <CurrencyComponent
                  :amount="utilizationLevelOsmosisAkt"
                  :fontSize="40"
                  :fontSizeSmall="32"
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
      <div class="flex items-center justify-between px-0 pt-4 md:justify-start">
        <div class="pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.yield") }}
            <Tooltip :content="$t('message.yield-tooltip')" />
          </p>

          <div class="flex items-center">
            <img
              class="mr-[6px]"
              src="@/assets/icons/osmosis-akt.svg"
            />
            <div>
              <CurrencyComponent
                :amount="(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_akt] ?? 0).toString()"
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

        <div class="pl-6 pt-3">
          <p class="flex items-center text-12 font-medium text-neutral-400">
            {{ $t("message.optimal") }}
            <Tooltip :content="$t('message.optimal-tooltip')" />
          </p>

          <CurrencyComponent
            :amount="optimal"
            :fontSize="16"
            :fontSizeSmall="12"
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
            :fontSize="16"
            :fontSizeSmall="12"
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
import { Tooltip } from "web-components";
import { useApplicationStore } from "@/common/stores/application";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

const utilizationLevelNeutron = ref("0");
const utilizationLevelOsmosis = ref("0");
const utilizationLevelOsmosisStAtom = ref("0");
const utilizationLevelOsmosisAllBtc = ref("0");
const utilizationLevelOsmosisAllSol = ref("0");
const utilizationLevelOsmosisAkt = ref("0");

const optimal = ref("70");
const depositSuspension = ref("65");
const app = useApplicationStore();

onMounted(async () => {
  await Promise.all([
    setUtilizationNeutron(),
    setUtilizationOsmosis(),
    setUtilizationOsmosisStAtom(),
    setUtilizationOsmosisAllBtc(),
    setUtilizationOsmosisAllSol(),
    setUtilizationOsmosisAkt()
  ]).catch((e) => Logger.error(e));
});

async function setUtilizationNeutron() {
  const data = await fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().neutron_noble}`);
  const item = await data.json();
  utilizationLevelNeutron.value = item[0];
}

async function setUtilizationOsmosis() {
  const data = await fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_noble}`);
  const item = await data.json();
  utilizationLevelOsmosis.value = item[0];
}

async function setUtilizationOsmosisStAtom() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_st_atom}`
  );
  const item = await data.json();
  utilizationLevelOsmosisStAtom.value = item[0];
}

async function setUtilizationOsmosisAllBtc() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_all_btc}`
  );
  const item = await data.json();
  utilizationLevelOsmosisAllBtc.value = item[0];
}

async function setUtilizationOsmosisAllSol() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_all_sol}`
  );
  const item = await data.json();
  utilizationLevelOsmosisAllSol.value = item[0];
}

async function setUtilizationOsmosisAkt() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_akt}`
  );
  const item = await data.json();
  utilizationLevelOsmosisAkt.value = item[0];
}
</script>

<style lang="" scoped></style>
