<template>
  <!-- Leases -->
  <div
    v-if="TEMPLATES.opened == status"
    class="background mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5 outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5">
        <p
          class="text-20 nls-font-500 mb-4 text-primary select-none"
          @dblclick="copy"
        >
          {{ $t("message.lease-position") }}
        </p>
        <div class="flex">
          <img
            :src="getAssetIcon"
            class="inline-block m-0 mr-3"
            height="36"
            width="36"
          />
          <h1 class="text-primary nls-font-700 text-28 md:text-28">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="amount"
              :font-size="22"
              :minimalDenom="asset.coinMinimalDenom"
              :denom="asset.coinDenom"
              :decimals="asset?.coinDecimals"
              :maxDecimals="6"
            />
            <span class="inline-block ml-1 text-primary text-20 nls-font-400 uppercase">
            </span>
          </h1>
        </div>
        <div class="flex flex-wrap text-10 uppercase whitespace-nowrap">
          <span
            class="bg-[#ebeff5] rounded p-1 m-1 garet-medium"
            v-if="leaseData"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>
          <!-- <span
            class="bg-[#ebeff5] rounded p-1 m-1 garet-medium"
            v-if="leaseData"
          >
            {{ $t("message.borrowed") }}: {{ loan }}
          </span> -->
          <span class="bg-[#ebeff5] rounded p-1 m-1 garet-medium">
            {{ `price per ${asset.coinDenom}:` }} {{ price }}
          </span>
          <span class="bg-[#ebeff5] rounded p-1 m-1 garet-medium">
            {{ $t("message.liq-trigger") }}: {{ liquidation }}
          </span>
        </div>
      </div>
      <div class="lg:col-span-2 md:px-6 px-2 pt-5 relative">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ asset.coinDenom }} {{ $t("message.price") }}
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
          <div
            class="flex-1 pnl-container"
            v-if="leaseData"
          >
            <div
              class="pnl text-12 nls-font-500 whitespace-pre	mr-2"
              :class="[pnl.status ? 'success' : 'alert']"
            >
              {{ $t('message.pnl') }} {{ pnl.status ? '+' : '' }}{{ pnl.amount }}
            </div>
          </div>
          <div class="relative w-full">
            <div
              v-if="leaseData"
              class="dash-pnl"
              :class="[pnl.status ? 'success' : 'alert']"
            >

            </div>
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between border-t border-standart pt-4 md:px-6 px-2 flex-col md:flex-row">
      <div class="flex">
        <div class="block">
          <p class="text-detail text-primary m-0 flex items-center">
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
          <p class="text-detail text-primary m-0 flex items-center">
            {{ $t("message.interest-fee") }}
            <TooltipComponent :content="$t('message.interest-fee-tooltip')" />
          </p>
          <p class="text-primary text-20 nls-font-400 m-0 mt-1">
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
          <p class="text-detail text-primary m-0 flex items-center">
            {{ $t("message.interest-due") }}
            <TooltipComponent :content="$t('message.interest-due-tooltip')" />
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
              :amount="interestDue"
              :hasSpace="false"
              :isDenomInfront="true"
              :font-size="20"
              :font-size-small="14"
              :decimals="4"
              denom="$"
            />
          </p>
        </div>
      </div>
      <button
        class="btn btn-secondary btn-large-secondary md:w-auto w-full md:mt-0 mt-4"
        v-if="leaseInfo.leaseStatus.opened"
        @click="showRepayModal = true"
      >
        {{ $t("message.repay") }}
      </button>

    </div>
  </div>

  <div
    v-if="TEMPLATES.opening == status"
    class="background mt-6 border-standart shadow-box radius-medium radius-0-sm outline"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div
        class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5 flex flex-col justify-between	"
      >
        <p
          class="text-20 nls-font-500 mb-4 text-primary select-none"
          @dblclick="copy"
        >
          {{ $t("message.lease-position") }}
        </p>
        <div class="flex flex-col">
          <h1 class="text-primary nls-font-700 text-28 md:text-28">
            {{ $t('message.opening') }}
          </h1>
        </div>
        <div class="flex flex-wrap text-10 uppercase whitespace-nowrap">
          <span
            class="bg-[#ebeff5] rounded p-1 px-[10px] mb-2 garet-medium"
            v-if="leaseData"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>
        </div>
        <div class="relative">
          <div class="state flex">
            <div class="status relative cursor-pointer">
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
      <div class="lg:col-span-2 md:px-6 px-2 pt-5 relative pb-5">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ asset.coinDenom }} {{ $t("message.price") }}
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
          <div
            class="flex-1 pnl-container"
            v-if="leaseData"
          >
            <div class="pnl text-12 nls-font-500 whitespace-pre	mr-2 grey">
              {{ $t('message.pnl') }} $0.00
            </div>
          </div>
          <div class="relative w-full">
            <div
              v-if="leaseData"
              class="dash-pnl grey"
            >

            </div>
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
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5">
        <p
          class="text-20 nls-font-500 mb-4 text-primary select-none"
          @dblclick="copy"
        >
          {{ $t("message.lease-position") }}
        </p>
        <div class="flex">
          <img
            :src="getAssetIcon"
            class="inline-block m-0 mr-3"
            height="36"
            width="36"
          />
          <h1 class="text-primary nls-font-700 text-28 md:text-28">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="amount"
              :font-size="22"
              :minimalDenom="asset.coinMinimalDenom"
              :denom="asset.coinDenom"
              :decimals="asset?.coinDecimals"
              :maxDecimals="6"
            />
            <span class="inline-block ml-1 text-primary text-20 nls-font-400 uppercase">
            </span>
          </h1>
        </div>
        <div
          v-if="leaseData"
          class="flex flex-wrap text-10 uppercase whitespace-nowrap mt-4"
        >
          <span class="bg-[#ebeff5] rounded p-1 m-1 garet-medium">
            {{ `price per ${asset.coinDenom}:` }} {{ price }}
          </span>
        </div>
      </div>
      <div class="lg:col-span-2 md:px-6 px-2 pt-5 relative">
        <!-- Graph -->
        <div class="flex justify-between">
          <div>
            <span class="text-dark-grey">
              {{ asset.coinDenom }} {{ $t("message.price") }}
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
          <div
            class="flex-1 pnl-container"
            v-if="leaseData"
          >
            <div
              class="pnl text-12 nls-font-500 whitespace-pre	mr-2"
              :class="[pnl.status ? 'success' : 'alert']"
            >
              {{ $t('message.pnl') }} {{ pnl.status ? '+' : '' }}{{ pnl.amount }}
            </div>
          </div>
          <div class="relative w-full">
            <div
              v-if="leaseData"
              class="dash-pnl"
              :class="[pnl.status ? 'success' : 'alert']"
            >

            </div>
            <PriceHistoryChart :chartData="chartData" />
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between border-t border-standart pt-4 md:px-6 px-2 flex-col md:flex-row">
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
        :txType="TxType.TRANSFER"
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
</template>

<script lang="ts" setup>
import { CONFIRM_STEP } from "@/types";
import type { LeaseData } from "@/types";
import { Lease, type BuyAssetOngoingState, type PaidLeaseInfo, type TransferOutOngoingState } from "@nolus/nolusjs/build/contracts";

import RepayDialog from "@/components/modals/RepayDialog.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import PriceHistoryChart from "@/components/templates/utils/NolusChart.vue";
import TooltipComponent from "./TooltipComponent.vue";
import CurrencyComponent from "./CurrencyComponent.vue";
import ConfirmComponent from "./modals/templates/ConfirmComponent.vue";
import DialogHeader from "./modals/templates/DialogHeader.vue";
import OpenChannel from "./icons/OpenChannel.vue";
import Transfer from "./icons/Transfer.vue";
import Swap from "./icons/Swap.vue";

import { computed, inject, onUnmounted, ref, onBeforeMount } from "vue";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { CHART_RANGES } from "@/config/globals";
import { useWalletStore } from "@/stores/wallet";
import { useOracleStore } from "@/stores/oracle";
import { useI18n } from "vue-i18n";
import { onMounted } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import { TxType } from "@/types";
import { StringUtils, WalletManager } from "@/utils";
import { GAS_FEES, TIP, NATIVE_ASSET, SNACKBAR, calculateLiquidation, INTEREST_DECIMALS } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { walletOperation } from "@/components/utils";

interface Props {
  leaseInfo: LeaseData;
}

enum TEMPLATES {
  'opening',
  'opened',
  'paid',
  'closed'
}

const OPENING_CHANNEL = 'open_ica_account';
const props = defineProps<Props>();
const showRepayModal = ref(false);
const chartTimeRange = ref(CHART_RANGES["1"]);
const i18n = useI18n();
console.log(props)
const chartData = ref();
const showClaimDialog = ref(false);
const walletStore = useWalletStore();
const oracleStore = useOracleStore();
const snackbarVisible = inject("snackbarVisible", () => false);
const showSnackbar = inject("showSnackbar", (_type: string, _transaction: string) => { });
const getLeases = inject("getLeases", () => { });
const claimDialog = ref()

let leaseData: {
  downPayment: string,
  price: string,
  leasePositionTicker: string
} | null = null;

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
  try {
    const data = localStorage.getItem(props.leaseInfo.leaseAddress);
    if (data) {
      leaseData = JSON.parse(data);
    }
  } catch (error) {
    console.log(error);
  }
});

onMounted(() => {
  loadCharts();
});

onUnmounted(() => {
  if (CONFIRM_STEP.PENDING == step.value) {
    showSnackbar(SNACKBAR.Queued, "loading");
  }
});

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

  if (props.leaseInfo.leaseStatus?.opening && leaseData) {
    const item = walletStore.getCurrencyByTicker(leaseData.leasePositionTicker as string);
    return oracleStore.prices[item.symbol].amount;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker;

  const item = walletStore.getCurrencyByTicker(ticker as string);
  return oracleStore.prices[item.symbol].amount;
});

const fetchChartData = async (days: string, interval: string) => {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${asset.value.coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`
  );
  const { prices } = await res.json();
  return prices;
}

const asset = computed(() => {

  if (props.leaseInfo.leaseStatus?.opening && leaseData) {
    const item = walletStore.getCurrencyByTicker(leaseData.leasePositionTicker as string);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol);
    const asset = walletStore.getCurrencyInfo(ibcDenom as string);
    return asset;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker;

  const item = walletStore.getCurrencyByTicker(ticker as string);
  const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol);
  const asset = walletStore.getCurrencyInfo(ibcDenom as string);
  return asset;

});

const getAssetIcon = computed((): string => {

  if (props.leaseInfo.leaseStatus?.opening && leaseData) {
    const item = walletStore.getCurrencyByTicker(leaseData.leasePositionTicker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol);
    return walletStore.getCurrencyInfo(ibcDenom as string).coinIcon;
  }

  const ticker =
    props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
    props.leaseInfo.leaseStatus?.opening?.downpayment.ticker ||
    props.leaseInfo.leaseStatus?.paid?.amount.ticker ||
    "";

  const item = walletStore.getCurrencyByTicker(ticker);
  const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol);
  return walletStore.getCurrencyInfo(ibcDenom as string).coinIcon;
});

const downPayment = computed(() => {
  const amount = new Dec((leaseData?.downPayment ?? '0'));
  return amount.toString(2);
});

const loan = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (data && leaseData) {
    const amount = data.amount.amount;
    const asset = walletStore.getCurrencyByTicker(data.amount.ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(asset.symbol) as string;
    const assetInfo = walletStore.getCurrencyInfo(ibcDenom);
    const loanInAsset = CurrencyUtils.convertMinimalDenomToDenom(amount, assetInfo.coinMinimalDenom, assetInfo.coinDenom, assetInfo.coinDecimals).toDec();

    const price = new Dec(leaseData.price);
    const downPaymentAmount = new Dec(leaseData.downPayment);
    const loan = loanInAsset.mul(price);

    return CurrencyUtils.formatPrice(loan.sub(downPaymentAmount).toString());

  }

  return '$0';
});

const price = computed(() => {
  return CurrencyUtils.formatPrice(getPrice().toString());

});

const amount = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened?.amount || props.leaseInfo.leaseStatus.opening?.downpayment || props.leaseInfo.leaseStatus.paid?.amount;
  return data?.amount ?? '0';
});

const debt = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;
  if (data) {
    const item = walletStore.getCurrencyByTicker(data.principal_due.ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol) as string;
    const amount = new Dec(data.principal_due.amount)
      .add(new Dec(data.previous_margin_due.amount))
      .add(new Dec(data.previous_interest_due.amount))
      .add(new Dec(data.current_margin_due.amount))
      .add(new Dec(data.current_interest_due.amount))

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      amount.truncate().toString(),
      ibcDenom,
      item.symbol,
      Number(item.decimal_digits)
    );
    return token.toDec().toString();
  }

  return '0'
});

const interestDue = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;

  if (data) {
    const item = walletStore.getCurrencyByTicker(data.current_interest_due.ticker);
    const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol) as string;
    const amount = new Dec(data.previous_margin_due.amount)
      .add(new Dec(data.previous_interest_due.amount))
      .add(new Dec(data.current_margin_due.amount))
      .add(new Dec(data.current_interest_due.amount))

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      amount.truncate().toString(),
      ibcDenom,
      item.symbol,
      Number(item.decimal_digits)
    );
    return token.toDec().toString();
  }

  return '0'
});


const interest = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;

  if (data) {
    return (data.loan_interest_rate / Math.pow(10, INTEREST_DECIMALS)).toString();
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
  const ibcDenom = walletStore.getIbcDenomBySymbol(item.symbol) as string;

  const token = CurrencyUtils.convertMinimalDenomToDenom(
    data.amount.amount,
    ibcDenom,
    item.symbol,
    Number(item.decimal_digits)
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
    const unitAsset = new Dec(lease.amount.amount, Number(unitAssetInfo.decimal_digits));
    const stableAsset = new Dec(lease.principal_due.amount, Number(stableAssetInfo.decimal_digits));
    const data = calculateLiquidation(stableAsset, unitAsset);
    return `$${data.toString(2)}`;
  }
  return '$0';
});

const pnl = computed(() => {
  const lease = props.leaseInfo.leaseStatus.opened ?? props.leaseInfo.leaseStatus.paid;

  if (lease) {
    const price = getPrice();
    const unitAssetInfo = walletStore.getCurrencyByTicker(lease.amount.ticker);
    const currentPrice = new Dec(oracleStore.prices?.[unitAssetInfo.symbol]?.amount ?? "0");
    const unitAsset = new Dec(lease.amount.amount, Number(unitAssetInfo.decimal_digits));


    const prevAmount = unitAsset.mul(price);
    const currentAmount = unitAsset.mul(currentPrice);
    const amount = currentAmount.sub(prevAmount);

    return {
      amount: CurrencyUtils.formatPrice(amount.toString()),
      status: currentAmount.gte(prevAmount),
    }
  }

  return {
    amount: '0',
    status: false
  }

});

const getPrice = () => {

  const paidLease = props.leaseInfo.leaseStatus.paid;

  if (paidLease && leaseData) {
    const totalAmount = new Dec(leaseData.downPayment);
    const assetData = walletStore.getCurrencyByTicker(paidLease.amount.ticker);
    const assetAmount = new Dec(paidLease.amount.amount, Number(assetData.decimal_digits))
    const p = totalAmount.quo(assetAmount);

    return p;
  }

  const openedLease = props.leaseInfo.leaseStatus.opened;

  if (openedLease && leaseData) {
    const item = walletStore.getCurrencyByTicker(openedLease.principal_due.ticker);

    const amount = new Dec(openedLease.principal_due.amount, Number(item.decimal_digits))
      .add(new Dec(openedLease.previous_margin_due.amount, Number(item.decimal_digits)))
      .add(new Dec(openedLease.previous_interest_due.amount, Number(item.decimal_digits)))
      .add(new Dec(openedLease.current_margin_due.amount, Number(item.decimal_digits)))
      .add(new Dec(openedLease.current_interest_due.amount, Number(item.decimal_digits)))

    const totalAmount = new Dec(leaseData.downPayment).add(amount);
    const assetData = walletStore.getCurrencyByTicker(openedLease.amount.ticker);
    const assetAmount = new Dec(openedLease.amount.amount, Number(assetData.decimal_digits))
    const p = totalAmount.quo(assetAmount);

    return p;
  }

  return new Dec(0);
}

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
</script>