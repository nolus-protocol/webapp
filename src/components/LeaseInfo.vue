<template>
  <!-- Leases -->
  <div
    v-if="TEMPLATES.opened == status"
    class="background mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5 outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-8">
      <div class="lg:col-span-3 px-2 md:px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5">
        <div
          class="flex-1 pnl-container"
          v-if="leaseData"
        >
          <div
            class="pnl text-12 nls-font-500 whitespace-pre	mr-2 flex items-center cursor-pointer"
            :class="[pnl.status ? 'success' : 'alert']"
            @click="pnlType = !pnlType"
          >
            <template v-if="pnl.status">
              <ArrowUp />
            </template>
            <template v-else>
              <ArrowDown />
            </template>
            &nbsp;{{ pnl.status ? '+' : '' }}<template v-if="!pnlType">{{ pnl.amount }}</template><template v-else>{{
              pnl.percent }}%</template>
          </div>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon flex icon-share text-primary share "
            @click="onShare"
          >
          </button>
          <div
            v-if="isFreeInterest"
            class="interest-free text-12 nls-font-500 whitespace-pre	mr-2 flex items-center cursor-pointer"
          >
            {{ $t('message.free-interest') }}
            <TooltipComponent
              class="!text-[#fff]"
              :content="$t('message.free-interest-tooltip')"
            />
          </div>
        </div>
        <div class="flex my-4">
          <img
            :src="getAssetIcon"
            class="inline-block m-0 mr-3"
            height="36"
            width="36"
            @dblclick="copy"
          />
          <h1 class="text-primary nls-font-700 text-28 md:text-28">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="amount"
              :font-size="22"
              :minimalDenom="asset.coinMinimalDenom"
              :denom="asset.shortName"
              :decimals="asset?.coinDecimals"
              :maxDecimals="6"
            />
            <span class="inline-block ml-1 text-primary text-20 nls-font-400 uppercase">
            </span>
          </h1>
        </div>
        <div class="flex flex-wrap text-10 uppercase whitespace-nowrap">
          <span
            class="text-medium-blue data-label-info rounded p-1 ml-0 mb-0 m-1.5 garet-medium"
            v-if="leaseData?.downPayment"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>

          <span class="text-medium-blue data-label-info rounded p-1 ml-0 mb-0 m-1.5 garet-medium">
            {{ `${$t("message.price-per")} ${asset.shortName}:` }} ${{ Number(leaseData?.price ?? 0).toFixed(4) }}
          </span>
          <span class="text-medium-blue data-label-info rounded p-1 ml-0 mb-0 m-1.5 garet-medium">
            {{ $t("message.liq-trigger") }}: {{ liquidation }}
          </span>
        </div>
      </div>
      <div class="lg:col-span-5 md:px-6 px-2 pt-3 md:pt-5 pb-3 md:pb-0 relative hidden md:block">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ $t("message.price") }}
            </span>
            <p class="text-primary">
              <b>
                <CurrencyComponent
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  :amount="currentPrice"
                  :hasSpace="false"
                  :isDenomInfront="true"
                  :font-size="20"
                  :font-size-small="14"
                  :decimals="4"
                  denom="$"
                />
              </b>
            </p>

          </div>
          <div class="flex text-10 h-6">
            <button
              v-for="(value, index) in CHART_RANGES"
              class="ml-2 w-10 justify-center border rounded chart-dates"
              :key="index"
              :class="`${value.label === chartTimeRange.label
                ? 'border-1 border-light-electric bg-[#0ea5e9]/10'
                : ''
                }`"
              @click="chartTimeRange = value; loadCharts()"
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <div class="flex relaltive">
          <div class="relative w-full md:block hidden">
            <div v-if="leaseData">
            </div>
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex items-center justify-between border-t-[0px] md:border-t-[1px] border-standart pt-4 md:px-6 px-2 flex-col md:flex-row"
    >
      <div class="flex">
        <div class="block">
          <p class="text-detail text-primary m-0 flex items-center data-text">
            {{ $t("message.outstanding-loan") }}
            <TooltipComponent :content="$t('message.outstanding-debt-tooltip')" />
          </p>
          <p class="text-primary text-20 nls-font-400 m-0 mt-1">
            <span
              v-if="openedSubState"
              class="state-loading"
            >

            </span>
            <CurrencyComponent
              v-else
              class="garet-medium"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="debt"
              :hasSpace="false"
              :isDenomInfront="true"
              :font-size="20"
              :font-size-small="14"
              :decimals="4"
              denom="$"
            />

          </p>
        </div>
        <div class="block ml-8">
          <p class="text-detail text-primary m-0 flex items-center data-text">
            {{ $t("message.interest-fee") }}
            <TooltipComponent :content="$t('message.interest-fee-tooltip')" />
          </p>
          <p
            class="text-primary text-20 nls-font-400 m-0 mt-1"
            :class="{ 'line-throught': isFreeInterest }"
          >
            <CurrencyComponent
              class="garet-medium"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="interest"
              :hasSpace="false"
              :isDenomInfront="false"
              :font-size="20"
              :font-size-small="14"
              :decimals="2"
              denom="%"
            />
          </p>
        </div>
        <div class="block ml-8">
          <p class="text-detail text-primary m-0 flex items-center data-text">
            {{ $t("message.interest-due") }}
            <TooltipComponent :content="$t('message.interest-due-tooltip')" />
          </p>
          <p class="text-primary text-20 nls-font-400 m-0 flex items-baseline">
            <span
              v-if="openedSubState"
              class="state-loading"
            >

            </span>
            <CurrencyComponent
              v-else
              class="garet-medium mt-1"
              :class="{ 'text-yellow': interestDueStatus }"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="interestDue"
              :hasSpace="false"
              :isDenomInfront="true"
              :font-size="20"
              :font-size-small="14"
              :decimals="4"
              denom="$"
            />
            <TooltipComponent
              v-if="interestDueStatus && !openedSubState"
              class="text-yellow"
              :content="$t('message.repay-interest')"
            />

          </p>
        </div>
      </div>
      <div class="flex w-full md:block md:w-auto">
        <button
          class="btn btn-secondary btn-large-secondary md:w-auto w-full md:mt-0 mt-4"
          v-if="leaseInfo.leaseStatus.opened"
          @click="showRepayModal = true"
          :disabled="openedSubState"
          :class="{ 'js-loading': loadingRepay }"
        >
          {{ $t("message.repay") }}
        </button>
        <button
          class="btn btn-primary btn-large-primary md:w-auto w-full md:mt-0 mt-4 ml-[12px]"
          v-if="leaseInfo.leaseStatus.opened"
          @click="showCloseModal = true"
          :disabled="openedSubState"
          :class="{ 'js-loading': loadingClose }"
        >
          {{ $t("message.close") }}
        </button>
      </div>

    </div>
  </div>

  <div
    v-if="TEMPLATES.opening == status"
    class="background mt-6 border-standart shadow-box lg:rounded-xl outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-8">
      <div
        class="lg:col-span-3 border-standart border-b lg:border-b-0 lg:border-r flex flex-col justify-between p-4 lg:p-6"
      >

        <div
          class="pnl-container"
          v-if="leaseData"
        >
          <div class="pnl text-12 nls-font-500 whitespace-pre	mr-2 grey">
            {{ $t('message.pnl') }} $0.00
          </div>
        </div>
        <div class="flex flex-col">
          <h1 class="text-primary nls-font-700 text-28 md:text-28">
            {{ $t('message.opening') }}
          </h1>
        </div>
        <div class="flex flex-wrap text-10 uppercase whitespace-nowrap">
          <span
            class="text-medium-blue data-label-info rounded p-1 ml-0 mb-0 m-1.5 garet-medium"
            v-if="leaseData?.downPayment"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>
        </div>
        <div class="relative">
          <div class="state flex pt-4 md:pt-0">
            <div class="status relative cursor-pointer state-background">
              <div class="state-status garet-medium">
                {{ $t("message.opening-channel") }}
              </div>
              <OpenChannel
                :width="16"
                :height="16"
                :class="openingSubState?.channel"
              />
            </div>
            <div class="status relative mx-4 cursor-pointer">
              <div class="state-status garet-medium">
                {{ $t("message.transferring-assets") }}
              </div>
              <Transfer
                :width="16"
                :height="16"
                :class="openingSubState?.transfer"
              />
            </div>
            <div class="status relative cursor-pointer">
              <div class="state-status garet-medium">
                {{ $t("message.swapping-assets") }}
              </div>
              <Swap
                :width="16"
                :height="16"
                :class="openingSubState?.swap"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="lg:col-span-5 md:px-6 px-2 pt-3 md:pt-5 pb-3 md:pb-5 relative hidden md:block">
        <!-- Graph -->

        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ $t("message.price") }}
            </span>
            <p class="text-primary">
              <b>
                <CurrencyComponent
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  :amount="currentPrice"
                  :hasSpace="false"
                  :isDenomInfront="true"
                  :font-size="20"
                  :font-size-small="14"
                  denom="$"
                />
              </b>
            </p>

          </div>
          <div class="flex text-10 h-6">
            <button
              v-for="(value, index) in CHART_RANGES"
              class="ml-2 w-10 justify-center border rounded chart-dates"
              :key="index"
              :class="`${value.label === chartTimeRange.label
                ? 'border-1 border-light-electric bg-[#0ea5e9]/10'
                : ''
                }`"
              @click="chartTimeRange = value; loadCharts()"
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <div class="flex relaltive">
          <div class="relative w-full md:block hidden">
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-if="TEMPLATES.paid == status"
    class="background mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5 outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-8">
      <div class="lg:col-span-3 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5">
        <div
          class="pnl-container"
          v-if="leaseData"
        >
          <div
            class="pnl text-12 nls-font-500 whitespace-pre	mr-2 flex items-center cursor-pointer"
            :class="[pnl.status ? 'success' : 'alert']"
            @click="pnlType = !pnlType"
          >
            <template v-if="pnl.status">
              <ArrowUp />
            </template>
            <template v-else>
              <ArrowDown />
            </template>
            &nbsp;{{ pnl.status ? '+' : '' }}<template v-if="!pnlType">{{ pnl.amount }}</template><template v-else>{{
              pnl.percent }}%</template>
          </div>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon flex icon-share text-primary share "
            @click="onShare"
          >
          </button>
          <div
            v-if="isFreeInterest"
            class="interest-free text-12 nls-font-500 whitespace-pre	mr-2 flex items-center cursor-pointer"
          >
            {{ $t('message.free-interest') }}
            <TooltipComponent
              :content="$t('message.free-interest-tooltip')"
              class="!text-[#fff]"
            />
          </div>
        </div>

        <div class="flex my-4 flex-col">
          <div class="flex">
            <img
              :src="getAssetIcon"
              class="inline-block m-0 mr-3"
              height="36"
              width="36"
              @dblclick="copy"
            />
            <h1 class="text-primary nls-font-700 text-28 md:text-28">
              <CurrencyComponent
                :type="CURRENCY_VIEW_TYPES.TOKEN"
                :amount="amount"
                :font-size="22"
                :minimalDenom="asset.coinMinimalDenom"
                :denom="asset.shortName"
                :decimals="asset?.coinDecimals"
                :maxDecimals="6"
              />
              <span class="inline-block ml-1 text-primary text-20 nls-font-400 uppercase">
              </span>
            </h1>
          </div>
          <div
            class="flex mt-[12px]"
            v-for="b of balances()"
            :key="b.coinMinimalDenom"
          >
            <img
              :src="b.icon"
              class="inline-block m-0 mr-3"
              height="36"
              width="36"
            />
            <h1 class="text-primary nls-font-700 text-28 md:text-28">
              <CurrencyComponent
                :type="CURRENCY_VIEW_TYPES.TOKEN"
                :amount="b.amount"
                :font-size="22"
                :minimalDenom="b.coinMinimalDenom.toString()"
                :denom="b.shortName"
                :decimals="Number(b.decimals)"
                :maxDecimals="6"
              />
              <span class="inline-block ml-1 text-primary text-20 nls-font-400 uppercase">
              </span>
            </h1>
          </div>
        </div>

      </div>
      <div class="lg:col-span-5 md:px-6 px-2 pt-3 md:pt-5 pb-3 md:pb-0  relative hidden md:block">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ $t("message.price") }}
            </span>
            <p class="text-primary">
              <b>
                <CurrencyComponent
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  :amount="currentPrice"
                  :hasSpace="false"
                  :isDenomInfront="true"
                  :font-size="20"
                  :font-size-small="14"
                  denom="$"
                />
              </b>
            </p>

          </div>
          <div class="flex text-10 h-6">
            <button
              v-for="(value, index) in CHART_RANGES"
              class="ml-2 w-10 justify-center border rounded chart-dates"
              :key="index"
              :class="`${value.label === chartTimeRange.label
                ? 'border-1 border-light-electric bg-[#0ea5e9]/10'
                : ''
                }`"
              @click="chartTimeRange = value; loadCharts()"
            >
              {{ value.label }}
            </button>
          </div>
        </div>
        <div class="flex relaltive">
          <div class="relative w-full md:block hidden">
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex items-center justify-between border-t-[0px] md:border-t-[1px] border-standart pt-4 md:px-6 px-2 flex-col md:flex-row"
    >
      <div class="flex">
      </div>
      <button
        class="btn btn-secondary btn-large-secondary md:w-auto w-full md:mt-0 mt-4"
        :class="{ 'js-loading': leaseInfo.leaseStatus?.paid?.in_progress }"
        @click="onShowClaimDialog"
      >
        {{ $t("message.collect") }}
      </button>

    </div>
  </div>
  <Modal
    v-if="showClaimDialog"
    @close-modal="showClaimDialog = false"
    route="claim"
    ref="claimDialog"
  >
    <DialogHeader :headerList="[$t('message.close-lease')]">
      <ConfirmComponent
        :selectedCurrency="state.selectedCurrency"
        :receiverAddress="state.receiverAddress"
        :password="state.password"
        :amount="state.amount"
        :txType="$t(`message.${TxType.TRANSFER}`)"
        :txHash="state.txHash"
        :step="step"
        :fee="state.fee"
        :onSendClick="onSendClick"
        :onBackClick="onConfirmBackClick"
        :onOkClick="onClickOkBtn"
        @passwordUpdate="(value: string) => state.password = value"
      />
    </DialogHeader>
  </Modal>

  <Modal
    v-if="showRepayModal"
    @close-modal="showRepayModal = false"
    route="repay"
  >
    <RepayDialog :lease-info="leaseInfo" />
  </Modal>

  <Modal
    v-if="showCloseModal"
    @close-modal="showCloseModal = false"
    route="market-close"
  >
    <MarketCloseDialog :lease-info="leaseInfo" />
  </Modal>

  <Modal
    v-if="showShareDialog"
    @close-modal="showShareDialog = false"
    route="share"
  >
    <ShareDialog
      :icon="getAssetIcon"
      :asset="asset.shortName"
      :price="price.toString()"
      :position="pnl.percent"
    />
  </Modal>
</template>

<script lang="ts" setup>
import { CONFIRM_STEP } from "@/types";
import type { LeaseData } from "@/types";
import { Lease, type BuyAssetOngoingState, type PaidLeaseInfo, type TransferOutOngoingState } from "@nolus/nolusjs/build/contracts";

import RepayDialog from "@/components/modals/RepayDialog.vue";
import MarketCloseDialog from "@/components/modals/MarketCloseDialog.vue";

import Modal from "@/components/modals/templates/Modal.vue";
import PriceHistoryChart from "@/components/templates/utils/NolusChart.vue";
import TooltipComponent from "./TooltipComponent.vue";
import CurrencyComponent from "./CurrencyComponent.vue";
import ConfirmComponent from "./modals/templates/ConfirmComponent.vue";
import DialogHeader from "./modals/templates/DialogHeader.vue";
import ShareDialog from "./modals/ShareDialog.vue";

import OpenChannel from "./icons/OpenChannel.vue";
import Transfer from "./icons/Transfer.vue";
import Swap from "./icons/Swap.vue";
import ArrowUp from "./icons/ArrowUp.vue";
import ArrowDown from "./icons/ArrowDown.vue";

import { computed, inject, onUnmounted, ref, onBeforeMount, watch } from "vue";
import { ChainConstants, CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { CHART_RANGES } from "@/config/globals";
import { useWalletStore } from "@/stores/wallet";
import { useOracleStore } from "@/stores/oracle";
import { useI18n } from "vue-i18n";
import { onMounted } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import { TxType } from "@/types";
import { AssetUtils, EnvNetworkUtils, StringUtils, WalletManager } from "@/utils";
import { GAS_FEES, TIP, NATIVE_ASSET, SNACKBAR, calculateLiquidation, INTEREST_DECIMALS, PERMILLE, PERCENT, calculateAditionalDebt, CoinGecko, NETWORKS, LPN_DECIMALS, MONTHS } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { walletOperation } from "@/components/utils";
import { useApplicationStore } from "@/stores/application";
import { AppUtils } from "@/utils/AppUtils";
import { ASSETS } from "@/config/assetsInfo";
import { QuerySmartContractStateRequest } from "cosmjs-types/cosmwasm/wasm/v1/query";
import { toUtf8 } from "@cosmjs/encoding";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { EtlApi } from "@/utils/EtlApi";

interface Props {
  leaseInfo: LeaseData;
}

enum TEMPLATES {
  'opening',
  'opened',
  'paid',
  'closed',
  'repayment'
}

const OPENING_CHANNEL = 'open_ica_account';
const props = defineProps<Props>();
const showRepayModal = ref(false);
const showCloseModal = ref(false);
const chartTimeRange = ref(CHART_RANGES["1"]);
const i18n = useI18n();
const chartData = ref();
const showClaimDialog = ref(false);
const walletStore = useWalletStore();
const oracleStore = useOracleStore();
const app = useApplicationStore();

const snackbarVisible = inject("snackbarVisible", () => false);
const showSnackbar = inject("showSnackbar", (_type: string, _transaction: string) => { });
const getLeases = inject("getLeases", () => { });
const claimDialog = ref();
const pnlType = ref(false);
const showShareDialog = ref(false);
const isFreeInterest = ref(false);
const downPaymentFee = ref(new Dec(0));

let leaseData = ref<{
  downPayment: string | null,
  downpaymentTicker: string | null,
  price: string,
  leasePositionTicker: string
} | null>(null);

const step = ref(CONFIRM_STEP.CONFIRM);
const state = ref({
  selectedCurrency: {
    balance: { amount: 0, denom: "" }
  },
  receiverAddress: WalletManager.getWalletAddress(),
  amount: "",
  memo: "",
  password: "",
  passwordErrorMsg: "",
  txHash: "",
  fee: coin(GAS_FEES.close_lease + TIP.amount, NATIVE_ASSET.denom),
});

onBeforeMount(() => {
  setLeaseOpening();
});

onMounted(() => {
  loadCharts();
  setFreeInterest();
});

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, "loading");
  }
});

watch(() => props.leaseInfo.leaseStatus?.opened, () => {
  setLeaseOpening();
});

const setLeaseOpening = () => {
  try {
    if(props.leaseInfo.leaseStatus?.opened || props.leaseInfo.leaseStatus?.paid){
      return checkPrice();

    }
    const data = JSON.parse(localStorage.getItem(props.leaseInfo.leaseAddress) ?? '{}');
    if (data.downPayment && data.downpaymentTicker && data.price && data.leasePositionTicker) {
      leaseData.value = data
      setDownPaymentAssetFee();
    } else {
      checkPrice();
    }
  } catch (error) {
    console.log(error);
  }
}

async function setDownPaymentAssetFee() {
  const fee = (await AppUtils.getOpenLeaseFee())[leaseData.value?.downpaymentTicker as string] ?? 0;
  downPaymentFee.value = new Dec(fee).mul(new Dec(leaseData.value?.downPayment ?? 0));
}

const setFreeInterest = async () => {
  const data = await AppUtils.getFreeInterestAddress();
  for (const item of data.interest_paid_to) {
    if (item == props.leaseInfo.leaseAddress) {
      isFreeInterest.value = true;
      break;
    }
  }
}

const loadCharts = async () => {
  const { days, interval } = chartTimeRange.value;
  const pricesData = await fetchChartData(days, interval);

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
}

const currentPrice = computed(() => {
  if (props.leaseInfo.leaseStatus?.opening && leaseData.value) {
    const item = app.currenciesData?.[leaseData?.value?.leasePositionTicker];
    return oracleStore.prices[item?.ibcData as string]?.amount ?? '0';
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker;

  const item = walletStore.getCurrencyByTicker(ticker as string);
  return oracleStore.prices[item!.ibcData as string]?.amount ?? '0';
});

const fetchChartData = async (days: string, interval: string) => {
  let coinGeckoId = asset.value.coinGeckoId;

  if (props.leaseInfo.leaseStatus?.opening && !leaseData.value) {
    const ticker =
      props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
      props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
      props.leaseInfo.leaseStatus?.paid?.amount.ticker;

    const item = walletStore.getCurrencyByTicker(ticker);
    const asset = walletStore.getCurrencyInfo(item?.ibcData as string);
    coinGeckoId = asset.coinGeckoId;
  }

  const res = await fetch(
    `${CoinGecko.url}/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}&x_cg_pro_api_key=${CoinGecko.key}`
  );
  const { prices } = await res.json();
  return prices;
}

const asset = computed(() => {

  if (props.leaseInfo.leaseStatus?.opening && leaseData) {
    const item = app.currenciesData?.[leaseData?.value?.leasePositionTicker as string]
    const ibcDenom = walletStore.getIbcDenomBySymbol(item?.symbol);
    const asset = walletStore.getCurrencyInfo(ibcDenom as string);
    return asset;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker;
  const item = walletStore.getCurrencyByTicker(ticker as string);

  const asset = walletStore.getCurrencyInfo(item?.ibcData as string);
  return asset;

});

const getAssetIcon = computed((): string => {

  if (props.leaseInfo.leaseStatus?.opening && leaseData) {
    const item = app.currenciesData?.[leaseData?.value?.leasePositionTicker as string]
    return app.assetIcons?.[item!.key as string] as string;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker ||
    "";

  const item = walletStore.getCurrencyByTicker(ticker);

  return app.assetIcons?.[item!.key as string] as string;
});

const downPayment = computed(() => {
  const fee = downPaymentFee.value as Dec;
  const amount = new Dec((leaseData.value?.downPayment ?? '0')).sub(fee);
  return amount.toString(2);
});

const price = computed(() => {
  return CurrencyUtils.formatPrice(getPrice.value.toString());

});

const amount = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened?.amount || props.leaseInfo.leaseStatus.opening?.downpayment || props.leaseInfo.leaseStatus.paid?.amount;
  return data?.amount ?? '0';
});

const debt = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;
  if (data) {
    const item = walletStore.getCurrencyByTicker(data.principal_due.ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item!.symbol) as string;
    const amount = new Dec(data.principal_due.amount)
      .add(new Dec(data.previous_margin_due.amount))
      .add(new Dec(data.previous_interest_due.amount))
      .add(new Dec(data.current_margin_due.amount))
      .add(new Dec(data.current_interest_due.amount))
      .add(additionalInterest().roundUpDec())

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      amount.truncate().toString(),
      ibcDenom,
      item!.symbol,
      Number(item!.decimal_digits)
    );
    return token.toDec().toString();
  }

  return '0'
});

const additionalInterest = () => {
  const data = props.leaseInfo.leaseStatus?.opened;
  if (data) {
    const principal_due = new Dec(data.principal_due.amount)
    const loanInterest = new Dec(data.loan_interest_rate / PERMILLE).add(new Dec(data.margin_interest_rate / PERCENT));
    const debt = calculateAditionalDebt(principal_due, loanInterest);

    return debt;
  }

  return new Dec(0)
}


const interestDue = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;

  if (data) {
    const item = walletStore.getCurrencyByTicker(data.current_interest_due.ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item!.symbol) as string;
    const amount = new Dec(data.previous_margin_due.amount)
      .add(new Dec(data.previous_interest_due.amount))
      .add(new Dec(data.current_margin_due.amount))
      .add(new Dec(data.current_interest_due.amount))
      .add(additionalInterest())

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      amount.truncate().toString(),
      ibcDenom,
      item!.symbol,
      Number(item!.decimal_digits)
    );
    return token.toDec().toString();
  }

  return '0'
});


const interest = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;
  if (data) {
    const config = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
    if (Number(props.leaseInfo?.height) > config.leaseBlockUpdate) {
      const amount = Number(data.loan_interest_rate) + Number(data.margin_interest_rate)
      return (amount / Math.pow(10, INTEREST_DECIMALS) / MONTHS).toFixed(2);
    }
    return (data.loan_interest_rate / Math.pow(10, INTEREST_DECIMALS) / MONTHS).toFixed(2);
  }

  return '0'
});

const status = computed(() => {
  if (props.leaseInfo.leaseStatus.opening) {
    return TEMPLATES.opening;
  }

  if (props.leaseInfo.leaseStatus.opened) {
    return TEMPLATES.opened;
  }

  if (props.leaseInfo.leaseStatus.paid) {
    return TEMPLATES.paid;
  }

  return null;
});

const onShowClaimDialog = () => {
  const data = props.leaseInfo.leaseStatus.paid as PaidLeaseInfo;
  if (data)
    showClaimDialog.value = true;

  const item = walletStore.getCurrencyByTicker(data.amount.ticker);
  const ibcDenom = walletStore.getIbcDenomBySymbol(item!.symbol) as string;
  const token = CurrencyUtils.convertMinimalDenomToDenom(
    data.amount.amount,
    ibcDenom,
    item!.symbol,
    Number(item!.decimal_digits)
  );

  state.value.amount = token.toDec().toString() ?? '0';
  state.value.selectedCurrency = {
    balance: {
      amount: 0,
      denom: ibcDenom
    }
  }
}

const onClaim = async () => {
  const data = props.leaseInfo.leaseStatus.paid;
  if (data) {
    try {
      const wallet = walletStore.wallet as NolusWallet;

      step.value = CONFIRM_STEP.PENDING;

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, props.leaseInfo.leaseAddress);

      const funds = [
        {
          denom: TIP.denom,
          amount: TIP.amount.toString()
        }
      ];

      const { txHash, txBytes, usedFee } = await leaseClient.simulateCloseLeaseTx(
        wallet,
        funds
      );

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }


      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }

      getLeases();

    } catch (e) {
      console.log(e)
      step.value = CONFIRM_STEP.ERROR;
    }
  }
}

const onSendClick = async () => {
  try {
    await walletOperation(onClaim, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

const onConfirmBackClick = () => {
  const close = claimDialog.value?.onModalClose;
  if (close) {
    close();
  }
  showClaimDialog.value = false;
}

const onClickOkBtn = () => {
  const close = claimDialog.value?.onModalClose;
  if (close) {
    close();
  }
  showClaimDialog.value = false;
  step.value = CONFIRM_STEP.CONFIRM;
}

const liquidation = computed(() => {
  const lease = props.leaseInfo.leaseStatus.opened;
  if (lease) {
    const unitAssetInfo = walletStore.getCurrencyByTicker(lease.amount.ticker);
    const stableAssetInfo = walletStore.getCurrencyByTicker(lease.principal_due.ticker);
    const unitAsset = new Dec(lease.amount.amount, Number(unitAssetInfo!.decimal_digits));
    const stableAsset = new Dec(lease.principal_due.amount, Number(stableAssetInfo!.decimal_digits));
    const data = calculateLiquidation(stableAsset, unitAsset);
    return `$${data.toString(4)}`;
  }
  return '$0';
});

const pnl = computed(() => {
  const lease = props.leaseInfo.leaseStatus.opened ?? props.leaseInfo.leaseStatus.paid;

  if (lease) {
    const price = getPrice.value;

    const unitAssetInfo = walletStore.getCurrencyByTicker(lease.amount.ticker);
    const currentPrice = new Dec(oracleStore.prices?.[unitAssetInfo!.ibcData as string]?.amount ?? "0");
    const unitAsset = new Dec(lease.amount.amount, Number(unitAssetInfo!.decimal_digits));

    const prevAmount = unitAsset.mul(price);

    let currentAmount = unitAsset.mul(currentPrice);

    for (const b of balances() ?? []) {
      const balance = new Dec(b.amount, Number(b.decimals));
      currentAmount = currentAmount.add(balance);
    }

    const amount = currentAmount.sub(prevAmount).add(downPaymentFee.value as Dec);
    const percent = amount.quo(prevAmount).mul(new Dec(100)).toString(2);
    return {
      percent,
      amount: CurrencyUtils.formatPrice(amount.toString()),
      status: currentAmount.gte(prevAmount),
    }
  }

  return {
    percent: '0',
    amount: '0',
    status: false,
  }

});

const getPrice = computed(() => {

  const paidLease = props.leaseInfo.leaseStatus.paid;

  if (paidLease && leaseData) {
    const totalAmount = new Dec(leaseData.value?.downPayment ?? '0' as string);
    const assetData = walletStore.getCurrencyByTicker(paidLease.amount.ticker);
    const assetAmount = new Dec(paidLease.amount.amount, Number(assetData!.decimal_digits))
    const p = totalAmount.quo(assetAmount);

    return p;
  }

  const openedLease = props.leaseInfo.leaseStatus.opened;

  if (openedLease && leaseData) {
    const item = walletStore.getCurrencyByTicker(openedLease.principal_due.ticker);
    const amount = new Dec(openedLease.principal_due.amount, Number(item!.decimal_digits))
      .add(new Dec(openedLease.previous_margin_due.amount, Number(item!.decimal_digits)))
      .add(new Dec(openedLease.previous_interest_due.amount, Number(item!.decimal_digits)))
      .add(new Dec(openedLease.current_margin_due.amount, Number(item!.decimal_digits)))
      .add(new Dec(openedLease.current_interest_due.amount, Number(item!.decimal_digits)))

    const totalAmount = new Dec(leaseData.value?.downPayment as string ?? '0').add(amount);
    const assetData = walletStore.getCurrencyByTicker(openedLease.amount.ticker);
    const assetAmount = new Dec(openedLease.amount.amount, Number(assetData!.decimal_digits))
    const p = totalAmount.quo(assetAmount);

    return p;
  }

  return new Dec(0);
});

const copy = () => {
  StringUtils.copyToClipboard(props.leaseInfo.leaseAddress);
}

const openingSubState = computed(() => {
  const data = props.leaseInfo.leaseStatus.opening;
  if (OPENING_CHANNEL == data?.in_progress) {
    return {
      channel: ['current'],
      transfer: [],
      swap: []
    }
  }

  const state = data?.in_progress as TransferOutOngoingState | BuyAssetOngoingState;

  if ((state as TransferOutOngoingState).transfer_out) {
    return {
      channel: ['ready'],
      transfer: ['current'],
      swap: []
    }
  }

  if ((state as BuyAssetOngoingState).buy_asset) {
    return {
      channel: ['ready'],
      transfer: ['ready'],
      swap: ['current']
    }
  }

  return {
    channel: [],
    transfer: [],
    swap: []
  }
});

const openedSubState = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;
  if (data?.in_progress != null) {
    return true
  }

  return false;
});

const loadingRepay = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, 'repayment')) {
    return true
  }

  return false;
});

const loadingClose = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, 'close')) {
    return true
  }

  return false;
});

const interestDueStatus = computed(() => {
  const lease = props.leaseInfo.leaseStatus?.opened;
  if (lease) {
    const amount = new Dec(lease.previous_margin_due.amount);
    if (amount.isPositive()) {
      return true;
    }
    return false;
  }
  return false;
});

const checkPrice = async () => {
  try {
    const result = await EtlApi.fetchLeaseOpening(props.leaseInfo.leaseAddress);
    const downpaymentTicker = result.lease.LS_cltr_symbol;
    const c = walletStore.getCurrencyByTicker(downpaymentTicker)
    const data = {
      downPayment: new Dec(result.lease.LS_cltr_amnt_stable, Number(c!.decimal_digits)).toString(),
      downpaymentTicker: result.lease.LS_cltr_symbol,
      leasePositionTicker: result.lease.LS_asset_symbol,
      price: result.downpayment_price,
    };
    leaseData.value = data;
    localStorage.setItem(props.leaseInfo.leaseAddress, JSON.stringify(data));
    loadCharts();
    setDownPaymentAssetFee();

  } catch (error) {
    console.log(error)
  }
}

// const getBlock = async (block: string) => {
//   try {
//     const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
//     const req = await fetch(`${url}/block?height=${block}`);
//     const data = await req.json();
//     const item = data.result?.block?.header?.time;
//     const ticker = props?.leaseInfo?.leaseStatus?.opened?.amount?.ticker ?? props?.leaseInfo?.leaseStatus?.paid?.amount?.ticker

//     if (item && ticker) {
//       const date = new Date(item);
//       const [priceData, downpayment] = await Promise.all([
//         fetchPrice(date, ticker),
//         fetchDownPayment(Number(block)),
//       ]);
//       const downpaymentPrice = await fetchDownPaymentPrice(date, downpayment.opening.downpayment.ticker);
//       const asset = AssetUtils.getAssetInfo(downpayment.opening.downpayment.ticker);

//       if (asset.coinDecimals == 0) {
//         return false;
//       }

//       const p = new Dec(downpaymentPrice);
//       const d = new Dec(downpayment.opening.downpayment.amount, asset.coinDecimals)

//       const dprice = d.mul(p);
//       const res = {
//         downpaymentTicker: downpayment.opening.downpayment.ticker,
//         price: priceData.price,
//         leasePositionTicker: ticker,
//         downPayment: dprice.toString()
//       };

//       localStorage.setItem(props.leaseInfo.leaseAddress, JSON.stringify(res));
//       leaseData.value = res;

//       setDownPaymentAssetFee();
//     }

//   } catch (error) {
//     console.log(error)
//   }
// }

// const fetchPrice = async (time: Date, ticker: string) => {

//   const asset = ASSETS[ticker as keyof typeof ASSETS];

//   const date = `${time.getDate()}-${time.getMonth() + 1}-${time.getFullYear()}`;
//   const req = await fetch(`${CoinGecko.url}/coins/${asset.coinGeckoId}/history?date=${date}&vs_currency=usd&localization=false&x_cg_pro_api_key=${CoinGecko.key}`);
//   const data = await req.json();
//   const price = data.market_data.current_price.usd;
//   return {
//     price: price,
//     leasePositionTicker: ticker
//   }

// }

// const fetchDownPaymentPrice = async (time: Date, ticker: string) => {

//   const asset = ASSETS[ticker as keyof typeof ASSETS];

//   const date = `${time.getDate()}-${time.getMonth() + 1}-${time.getFullYear()}`;
//   const req = await fetch(`${CoinGecko.url}/coins/${asset.coinGeckoId}/history?date=${date}&vs_currency=usd&localization=false&x_cg_pro_api_key=${CoinGecko.key}`);
//   const data = await req.json();
//   const price = data.market_data.current_price.usd;

//   return price;

// }

// const fetchDownPayment = async (block: number) => {
//   const node = (await AppUtils.getArchiveNodes());
//   const client = await Tendermint34Client.connect(node.archive_node_rpc);

//   const data = QuerySmartContractStateRequest.encode({
//     address: props.leaseInfo.leaseAddress,
//     queryData: toUtf8(JSON.stringify({})),
//   }).finish();

//   const query = {
//     path: '/cosmwasm.wasm.v1.Query/SmartContractState',
//     data,
//     prove: true,
//     height: block
//   };

//   const response = await client.abciQuery(query);
//   const res = QuerySmartContractStateRequest.decode(response.value);
//   return JSON.parse(res.address);
// }

const onShare = async () => {
  showShareDialog.value = true;
}

const balances = () => {
  const disable = [NATIVE_ASSET.denom];
  const ticker = props.leaseInfo.leaseStatus?.paid?.amount.ticker;
  if (ticker) {
    const asset = walletStore.getCurrencyByTicker(ticker);
    const ibc = asset?.ibcData as string;
    disable.push(ibc);
  }
  return props.leaseInfo.balances?.filter((item) => {
    if (disable.includes(item.denom)) {
      return false;
    }
    return true;
  }).map((item) => {
    const currency = walletStore.currencies[item.denom];

    return {
      amount: item.amount,
      icon: app.assetIcons?.[currency.ticker] as string,
      decimals: currency.decimal_digits,
      shortName: currency.shortName,
      coinMinimalDenom: 1
    }

  })
}

</script>
<style lang="scss">
button.share {
  padding: 6px 6px 6px 4px !important;
  font-size: 1.1rem !important;
}

div.interest-free {
  background-color: rgb(255, 185, 34);
  color: white;
  margin-left: 8px;
  display: flex;
  padding: 6px;
  border-radius: 4px;
}
</style>
