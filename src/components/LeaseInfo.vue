<template>
  <!-- Leases -->
  <div
    v-if="leaseInfo.leaseStatus"
    class="background mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5 outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div
        class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5"
      >
        <p class="text-20 nls-font-500 mb-4">
          {{ $t("message.lease-position") }}
        </p>
        <div class="flex">
          <img
            :src="getAssetIcon"
            class="inline-block m-0 mr-3"
            height="36"
            width="36"
          />
          <h1 class="text-primary nls-font-700 text-28 md:text-32">
            {{
              leaseInfo.leaseStatus?.opened?.amount?.amount ||
              leaseInfo.leaseStatus?.paid?.amount ||
              ""
            }}
            <span
              class="inline-block ml-1 text-primary text-20 nls-font-400 uppercase"
            >
              {{ getAssetInfo("coinDenom") }}
            </span
            >
          </h1>
        </div>
        <div class="flex flex-wrap text-10 uppercase whitespace-nowrap">
          <!-- @TODO: Fetch this data -->
          <span class="bg-[#ebeff5] rounded p-1 m-1">
            {{ $t('message.down-payment') }}: $20,000.00
          </span>
          <span class="bg-[#ebeff5] rounded p-1 m-1">
            {{ $t('message.loan') }}: $60,000.00
          </span>
          <span class="bg-[#ebeff5] rounded p-1 m-1">
            {{ `price per ${getAssetInfo("coinDenom")}:` }}$29,345.00
          </span>
          <span class="bg-[#ebeff5] rounded p-1 m-1">
            {{ $t('message.liq-trigger') }}: $10,000.00
          </span>
        </div>
      </div>
      <div class="lg:col-span-2 px-6 pt-5">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            {{ $t('message.current-price') }}
            <p>
              <b>{{ currentPrice }}</b>
            </p>
          </div>
          <div class="flex text-10 h-6">
            <button
              v-for="value in CHART_RANGES"
              class="ml-2 w-10 justify-center border rounded"
              :class="`${
                value.label === chartTimeRange.label
                  ? 'border-1 border-light-electric bg-[#0ea5e9]/10'
                  : ''
              }`"
              @click="chartTimeRange = value"
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <PriceHistoryChart :chartData="chartData" />
      </div>
    </div>
    <div class="flex items-center justify-between border-t border-standart pt-4 px-6">
      <div class="flex">
        <div class="block">
          <p class="text-detail text-primary m-0">
            {{ $t("message.outstanding-loan") }}
          </p>
          <p class="text-primary text-20 nls-font-400 m-0 mt-1">
            {{
              calculateBalance(
                leaseInfo.leaseStatus?.opened?.amount?.amount,
                leaseInfo.leaseStatus?.opened?.amount?.ticker
              )
            }}
          </p>
        </div>
        <div class="block ml-8">
          <p class="text-detail text-primary m-0 flex items-center">
            {{ $t("message.interest-fee") }}
            <TooltipComponent :content="$t('message.interest-fee-tooltip')" />
          </p>
          <p class="flex items-center text-primary text-20 nls-font-400 m-0 mt-1">
            {{
              formatInterestRate(leaseInfo.leaseStatus?.opened?.interest_rate)
            }}
          </p>
        </div>
        <div class="block ml-8">
          <p class="text-detail text-primary m-0 flex items-center">
            {{ $t("message.interest-due") }}
            <TooltipComponent :content="$t('message.interest-due-tooltip')" />
          </p>
          <p class="flex items-center text-primary text-20 nls-font-400 m-0 mt-1">
            {{
              calculateBalance(
                leaseInfo.leaseStatus?.opened?.current_interest_due?.amount,
                leaseInfo.leaseStatus?.opened?.current_interest_due?.ticker
              )
            }}
          </p>
        </div>
      </div>
      <button
        class="btn btn-secondary btn-large-secondary"
        v-if="leaseInfo.leaseStatus.opened"
        @click="showRepayModal = true"
      >
        {{ $t("message.repay") }}
      </button>

      <button
        class="btn btn-secondary btn-large-secondary"
        v-if="leaseInfo.leaseStatus.paid"
        @click="onClickClaim(leaseInfo?.leaseAddress)"
      >
        {{ $t("message.claim") }}
      </button>
    </div>
  </div>

  <Modal v-if="showRepayModal" @close-modal="showRepayModal = false" route="repay">
    <RepayDialog :lease-info="leaseInfo" />
  </Modal>
</template>

<script lang="ts" setup>
import type { AssetInfo } from "@/types";
import type { LeaseData } from "@/types";

import RepayDialog from "@/components/modals/RepayDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import PriceHistoryChart from "@/components/templates/utils/NolusChart.vue";
import TooltipComponent from "./TooltipComponent.vue";

import { computed, ref, watchEffect } from "vue";
import { Lease } from "@nolus/nolusjs/build/contracts";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { ChainConstants } from "@nolus/nolusjs/build/constants";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CHART_RANGES } from "@/config/globals";
import { WalletUtils } from "@/utils/WalletUtils";
import { useWalletStore } from "@/stores/wallet";
import { useOracleStore } from "@/stores/oracle";
import { useI18n } from "vue-i18n";

interface Props {
  leaseInfo: LeaseData | any; //TODO: update Asset in nolusjs
}

const { leaseInfo } = defineProps<Props>();
const showRepayModal = ref(false);
const chartTimeRange = ref(CHART_RANGES["1"]);
const chartData = ref({});
const currentPrice = ref<string>();
const walletStore = useWalletStore();
const oracleStore = useOracleStore();
const i18n = useI18n();

watchEffect(async () => {
  const { days, interval } = chartTimeRange.value;
  const pricesData = await fetchChartData(days, interval);

  if (days === "1") {
    currentPrice.value = `$${pricesData[pricesData.length - 1][1].toFixed(2)}`;
  }

  chartData.value = {
    datasets: [
      {
        label: i18n.t("message.chart-tooltip-price"),
        borderColor: "#2868E1",
        data: pricesData,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };
});

async function fetchChartData(days: string, interval: string) {
  // @TODO: Cache bigger time ranges
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${getAssetInfo(
      "coinGeckoId"
    )}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`
  );
  const { prices } = await res.json();
  return prices;
}

async function onClickClaim(leaseAddress: string) {
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const leaseClient = new Lease(cosmWasmClient, leaseAddress);
  const coinDecimals = new Int(10).pow(new Int(6).absUInt());
  const feeAmount = new Dec("0.25").mul(new Dec(coinDecimals));
  const DEFAULT_FEE = {
    amount: [
      {
        denom: ChainConstants.COIN_MINIMAL_DENOM,
        amount: WalletUtils.isConnectedViaExtension()
          ? "0.25"
          : feeAmount.truncate().toString(),
      },
    ],
    gas: "2000000",
  };

  const wallet = walletStore.wallet as NolusWallet;

  if (wallet) {
    const result = await leaseClient.closeLease(wallet, DEFAULT_FEE, undefined);
  }
}

function getAssetInfo(key: keyof AssetInfo) {
  const ticker =
    leaseInfo.leaseStatus?.opened?.amount.ticker ||
    leaseInfo.leaseStatus?.paid?.ticker;

  if (ticker) {
    const item = walletStore.getCurrencyByTicker(ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol);
    const asset = walletStore.getCurrencyInfo(ibcDenom as string);
    return asset[key];
  }

  return "";
}

function formatInterestRate(interestRatePromile = 0) {
  return new Dec(interestRatePromile).quo(new Dec(10)).toString(1) + "%";
}

function calculateBalance(tokenAmount = "0", denom = "") {
  const prices = oracleStore.prices;
  if (prices) {
    const coinPrice = prices[denom]?.amount || "0";
    const coinAmount = new Coin(denom, new Int(tokenAmount));
    return CurrencyUtils.calculateBalance(coinPrice, coinAmount, 0).toString();
  }

  return CurrencyUtils.calculateBalance(
    "0",
    new Coin("", new Int(0)),
    0
  ).toString();
}

const getAssetIcon = computed((): string => {
  const ticker =
    leaseInfo.leaseStatus?.opened?.amount.ticker ||
    leaseInfo.leaseStatus?.paid?.ticker ||
    "";
    const item = walletStore.getCurrencyByTicker(ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol);
  return walletStore.getCurrencyInfo(ibcDenom as string).coinIcon;
})
</script>
