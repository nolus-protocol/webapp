<template>
  <!-- OPENED -->
  <LeaseNew
    v-if="TEMPLATES.opened == status"
    class="mt-6"
    v-bind="leaseOpened"
    @on-repay="showRepayModal = true"
    @on-close="showCloseModal = true"
    @on-share="onShare"
  >
    <template #pnl-slot>
      <template v-if="!pnlType">{{ pnl.amount }}</template>
      <template v-else>{{ pnl.percent }}%</template>
    </template>
    <template #tab-0>
      <div class="flex items-center justify-between">
        <div class="text-12 font-medium text-neutral-400">
          {{ $t("message.chart") }}
        </div>

        <div class="flex gap-2">
          <div class="flex items-center gap-1">
            <img
              :src="getAssetIcon"
              class="h-[28px] w-[28px] object-contain"
              width="25"
            />
            <div>
              <CurrencyComponent
                :amount="focusPrice ?? currentPrice"
                :decimals="4"
                :font-size="20"
                :font-size-small="14"
                :hasSpace="false"
                :isDenomInfront="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
                denom="$"
              />
            </div>
          </div>
          <Dropdown
            :on-select="
              (data: any) => {
                chartTimeRange = data;
                loadCharts();
              }
            "
            :options="options"
            class="h-[28px] w-[72px]"
          />
        </div>
      </div>
      <div class="relaltive flex">
        <div class="relative w-full">
          <div v-if="leaseInfo.leaseData"></div>
          <PriceHistoryChart
            :chartData="chartData"
            class="max-h-[100px]"
            @in-focus="onFocusChart"
          />
        </div>
      </div>
    </template>
    <template #tab-1>
      <div class="flex h-full flex-col justify-between gap-2 lg:gap-0">
        <div class="text-12 font-medium text-neutral-400">{{ $t("message.lease-size") }}</div>
        <div>
          <template v-if="PositionTypes.long == ProtocolsConfig[props.leaseInfo.protocol].type">
            <div class="flex">
              <img
                :src="getAssetIcon"
                class="m-0 mr-3 inline-block"
                height="36"
                width="36"
                @dblclick="copy"
              />

              <h1 class="text-28 font-semibold text-neutral-typography-200 md:text-28">
                <CurrencyComponent
                  :amount="amount"
                  :decimals="asset?.decimal_digits"
                  :denom="asset!.shortName"
                  :font-size="22"
                  :maxDecimals="6"
                  :minimalDenom="asset!.ibcData"
                  :type="CURRENCY_VIEW_TYPES.TOKEN"
                />
                <span class="ml-1 inline-block text-20 font-normal uppercase text-neutral-typography-200"> </span>
              </h1>
            </div>
            <span class="text-15 pl-[50px] font-extralight text-neutral-400">${{ positionInStable }}</span>
          </template>
          <template v-if="PositionTypes.short == ProtocolsConfig[props.leaseInfo.protocol].type">
            <div class="flex">
              <img
                :src="leaseAsset!.icon"
                class="m-0 mr-3 inline-block"
                height="36"
                width="36"
                @dblclick="copy"
              />

              <h1 class="text-28 font-semibold text-neutral-typography-200 md:text-28">
                <CurrencyComponent
                  :amount="positionInStable"
                  :decimals="leaseAsset?.decimal_digits"
                  :denom="leaseAsset!.shortName"
                  :font-size="22"
                  :maxDecimals="6"
                  :minimalDenom="asset!.ibcData"
                  :type="CURRENCY_VIEW_TYPES.TOKEN"
                />
                <span class="ml-1 inline-block text-20 font-normal uppercase text-neutral-typography-200"> </span>
              </h1>
            </div>
            <span class="text-15 pl-[50px] font-extralight text-neutral-400">{{ amount }} {{ asset!.shortName }}</span>
          </template>
        </div>
        <div class="flex flex-wrap gap-2 whitespace-nowrap text-10 font-medium uppercase text-medium-blue">
          <span
            v-if="leaseInfo.leaseData?.downPayment"
            class="data-label-info rounded p-1"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>

          <span
            v-if="leaseInfo.leaseData"
            class="data-label-info rounded p-1"
          >
            {{ `${$t("message.price-per")} ${asset!.shortName}:` }} ${{ getPrice() }}
          </span>
          <span class="data-label-info rounded p-1"> {{ $t("message.liq-trigger") }}: {{ liquidation }} </span>
          <span class="data-label-info rounded p-1"> {{ $t("message.impact-fee") }} ${{ fee }} </span>
        </div>
      </div>
    </template>
    <template #debt-1>
      <CurrencyComponent
        :amount="leaseInfo.debt.toString()"
        :decimals="lpn.decimal_digits"
        :font-size="20"
        :font-size-small="14"
        :hasSpace="true"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        class="garet-medium"
        :denom="AssetUtils.getLpnByProtocol(leaseInfo.protocol)?.shortName"
      />
    </template>
    <template #interest-0>
      <p :class="{ 'line-throught': isFreeInterest }">
        <CurrencyComponent
          :amount="interest"
          :decimals="2"
          :font-size="20"
          :font-size-small="14"
          :hasSpace="false"
          :isDenomInfront="false"
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          class="garet-medium"
          denom="%"
        />
      </p>
    </template>
    <template #interest-1>
      <div class="flex items-center">
        <div>
          <CurrencyComponent
            :amount="interestDue"
            :class="{ 'text-warning-100': interestDueStatus }"
            :decimals="lpn.decimal_digits"
            :font-size="20"
            :font-size-small="14"
            :hasSpace="true"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            class="garet-medium mt-1"
            :denom="AssetUtils.getLpnByProtocol(leaseInfo.protocol)?.shortName"
          />
        </div>
        <TooltipComponent
          v-if="interestDueStatus && !openedSubState"
          :content="$t('message.repay-interest', { dueDate: interestDueDate })"
          class="text-yellow"
        />
      </div>
    </template>
  </LeaseNew>

  <!-- OPENING -->
  <LeaseNew
    v-if="TEMPLATES.opening == status"
    class="mt-6"
    v-bind="leaseOpening"
  >
    <template #pnl-slot>
      <template v-if="!pnlType">{{ pnl.amount }}</template>
      <template v-else>{{ pnl.percent }}%</template>
    </template>
    <template #tab-0>
      <div class="flex items-center justify-between">
        <div class="text-12 font-medium text-neutral-400">
          {{ $t("message.chart") }}
        </div>
        <div class="flex gap-2">
          <div class="flex items-center gap-1">
            <img
              :src="getAssetIcon"
              class="h-[28px] w-[28px] object-contain"
            />
            <div>
              <CurrencyComponent
                :amount="focusPrice ?? currentPrice"
                :decimals="2"
                :font-size="20"
                :font-size-small="14"
                :hasSpace="false"
                :isDenomInfront="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
                denom="$"
              />
            </div>
          </div>
          <Dropdown
            :on-select="
              (data: any) => {
                chartTimeRange = data;
                loadCharts();
              }
            "
            :options="options"
            class="h-[28px] w-[72px]"
          />
        </div>
      </div>
      <div class="relaltive flex">
        <div class="relative w-full">
          <PriceHistoryChart
            :chartData="chartData"
            class="max-h-[100px]"
            @in-focus="onFocusChart"
          />
        </div>
      </div>
    </template>
  </LeaseNew>

  <!-- PAID -->
  <LeaseNew
    v-if="TEMPLATES.paid == status"
    class="mt-6"
    v-bind="leasePaid"
    @on-share="onShare"
    @on-collect="onShowClaimDialog"
  >
    <template #pnl-slot>
      <template v-if="!pnlType">{{ pnl.amount }}</template>
      <template v-else>{{ pnl.percent }}%</template>
    </template>
    <template #tab-1>
      <div class="flex h-full flex-col justify-between gap-2 lg:gap-0">
        <div class="text-12 font-medium text-neutral-400">{{ $t("message.lease-size") }}</div>

        <div>
          <template v-if="PositionTypes.long == ProtocolsConfig[props.leaseInfo.protocol].type">
            <div class="flex">
              <img
                :src="getAssetIcon"
                class="m-0 mr-3 inline-block"
                height="36"
                width="36"
                @dblclick="copy"
              />

              <h1 class="text-28 font-semibold text-neutral-typography-200 md:text-28">
                <CurrencyComponent
                  :amount="amount"
                  :decimals="asset?.decimal_digits"
                  :denom="asset!.shortName"
                  :font-size="22"
                  :maxDecimals="6"
                  :minimalDenom="asset!.ibcData"
                  :type="CURRENCY_VIEW_TYPES.TOKEN"
                />
                <span class="ml-1 inline-block text-20 font-normal uppercase text-neutral-typography-200"> </span>
              </h1>
            </div>
            <span class="text-15 pl-[50px] font-extralight text-neutral-400">${{ positionInStable }}</span>
          </template>
          <template v-if="PositionTypes.short == ProtocolsConfig[props.leaseInfo.protocol].type">
            <div class="flex">
              <img
                :src="leaseAsset!.icon"
                class="m-0 mr-3 inline-block"
                height="36"
                width="36"
                @dblclick="copy"
              />

              <h1 class="text-28 font-semibold text-neutral-typography-200 md:text-28">
                <CurrencyComponent
                  :amount="positionInStable"
                  :decimals="leaseAsset?.decimal_digits"
                  :denom="leaseAsset!.shortName"
                  :font-size="22"
                  :maxDecimals="6"
                  :minimalDenom="asset!.ibcData"
                  :type="CURRENCY_VIEW_TYPES.TOKEN"
                />
                <span class="ml-1 inline-block text-20 font-normal uppercase text-neutral-typography-200"> </span>
              </h1>
            </div>
            <span class="text-15 pl-[50px] font-extralight text-neutral-400">{{ amount }} {{ asset!.shortName }}</span>
          </template>
        </div>

        <div class="flex flex-wrap gap-2 whitespace-nowrap text-10 font-medium uppercase text-medium-blue">
          <span
            v-if="leaseInfo.leaseData?.downPayment"
            class="data-label-info rounded p-1"
          >
            {{ $t("message.down-payment") }}: ${{ downPayment }}
          </span>

          <span
            v-if="leaseInfo.leaseData"
            class="data-label-info rounded p-1"
          >
            {{ `${$t("message.price-per")} ${asset!.shortName}:` }} ${{ getPrice() }}
          </span>
          <span class="data-label-info rounded p-1"> {{ $t("message.liq-trigger") }}: {{ liquidation }} </span>
          <span class="data-label-info rounded p-1"> {{ $t("message.impact-fee") }} ${{ fee }} </span>
        </div>
      </div>
    </template>
  </LeaseNew>

  <Modal
    v-if="showClaimDialog"
    ref="claimDialog"
    route="claim"
    @close-modal="showClaimDialog = false"
  >
    <DialogHeader :headerList="[$t('message.close-lease')]">
      <ConfirmComponent
        :amount="state.amount"
        :fee="state.fee"
        :onBackClick="onConfirmBackClick"
        :onOkClick="onClickOkBtn"
        :onSendClick="onSendClick"
        :receiverAddress="state.receiverAddress"
        :selectedCurrency="state.selectedCurrency"
        :step="step"
        :txHash="state.txHash"
        :txType="$t(`message.${TxType.TRANSFER}`)"
      />
    </DialogHeader>
  </Modal>

  <Modal
    v-if="showRepayModal"
    route="repay"
    @close-modal="showRepayModal = false"
  >
    <RepayDialog :lease-info="leaseInfo" />
  </Modal>

  <Modal
    v-if="showCloseModal"
    route="market-close"
    @close-modal="showCloseModal = false"
  >
    <MarketCloseDialog :lease-info="leaseInfo" />
  </Modal>

  <Modal
    v-if="showShareDialog"
    route="share"
    @close-modal="showShareDialog = false"
  >
    <ShareDialog
      :asset="asset!.shortName"
      :icon="getAssetIcon"
      :position="pnl.percent"
      :price="getSharePrice()"
      :position-type="ProtocolsConfig[props.leaseInfo.protocol].type"
    />
  </Modal>
</template>

<script lang="ts" setup>
import {
  Dropdown,
  Lease as LeaseNew,
  LeaseOpeningBarStatuses,
  LeasePnlStatus,
  type LeaseProps,
  LeaseStatus
} from "web-components";
import type { LeaseData } from "@/common/types";
import { CONFIRM_STEP, CURRENCY_VIEW_TYPES, TxType } from "@/common/types";

import RepayDialog from "@/common/components/modals/RepayDialog.vue";
import MarketCloseDialog from "@/common/components/modals/MarketCloseDialog.vue";

import Modal from "@/common/components/modals/templates/Modal.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import ConfirmComponent from "@/common/components/modals/templates/ConfirmComponent.vue";
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import ShareDialog from "@/common/components/modals/ShareDialog.vue";

import { computed, inject, onMounted, type PropType, ref } from "vue";
import { CurrencyUtils, NolusClient, NolusWallet } from "@nolus/nolusjs";
import {
  type BuyAssetOngoingState,
  Lease,
  type OpenedLeaseInfo,
  type PaidLeaseInfo,
  type TransferOutOngoingState
} from "@nolus/nolusjs/build/contracts";
import { Dec } from "@keplr-wallet/unit";
import {
  CHART_RANGES,
  GAS_FEES,
  LEASE_DUE,
  MAX_DECIMALS,
  NATIVE_ASSET,
  PositionTypes,
  ProtocolsConfig,
  TIP
} from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { useI18n } from "vue-i18n";
import {
  AppUtils,
  AssetUtils,
  datePraser,
  EtlApi,
  formatDate,
  Logger,
  StringUtils,
  WalletManager,
  walletOperation
} from "@/common/utils";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/common/stores/application";
import { PriceHistoryChart } from "./";
import { CurrencyDemapping, CurrencyMapping } from "@/config/currencies";

enum TEMPLATES {
  "opening",
  "opened",
  "paid",
  "closed",
  "repayment"
}

const OPENING_CHANNEL = "open_ica_account";
const props = defineProps({
  leaseInfo: {
    type: Object as PropType<LeaseData | any>,
    required: true
  }
});

const showRepayModal = ref(false);
const showCloseModal = ref(false);
const chartTimeRange = ref(CHART_RANGES["1"]);
const i18n = useI18n();
const chartData = ref();
const showClaimDialog = ref(false);
const walletStore = useWalletStore();
const oracleStore = useOracleStore();
const app = useApplicationStore();
const options = Object.values(CHART_RANGES).map((value) => ({
  ...value,
  value: value.label
}));

const getLeases = inject("getLeases", () => {});
const claimDialog = ref();
const pnlType = ref(false);
const showShareDialog = ref(false);
const isFreeInterest = ref(false);
const focusPrice = ref<string | null>();

const step = ref(CONFIRM_STEP.CONFIRM);
const state = ref({
  selectedCurrency: {
    balance: { amount: 0, denom: "" }
  },
  receiverAddress: WalletManager.getWalletAddress(),
  amount: "",
  memo: "",
  txHash: "",
  fee: coin(GAS_FEES.close_lease + TIP.amount, NATIVE_ASSET.denom)
});

onMounted(() => {
  loadCharts();
  setFreeInterest();
});

const lpn = computed(() => {
  const l = AssetUtils.getLpnByProtocol(props.leaseInfo.protocol);
  return l;
});

async function setFreeInterest() {
  const data = await AppUtils.getFreeInterestAddress();
  for (const item of data.interest_paid_to) {
    if (item == props.leaseInfo.leaseAddress) {
      isFreeInterest.value = true;
      break;
    }
  }
}

async function loadCharts() {
  const { days } = chartTimeRange.value;
  const pricesData = await fetchChartData(days);

  chartData.value = {
    datasets: [
      {
        label: i18n.t("message.chart-tooltip-price"),
        borderColor: "#2868E1",
        data: pricesData,
        tension: 0.4,
        pointRadius: 0
      }
    ]
  };
}

const currentPrice = computed(() => {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
        const item = app.currenciesData?.[props.leaseInfo.leaseData?.leasePositionTicker as string];
        return oracleStore.prices[item?.ibcData as string]?.amount ?? "0";
      }
      break;
    }
    case PositionTypes.short: {
      if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
        return (
          oracleStore.prices[`${props.leaseInfo.leaseStatus.opening.loan.ticker}@${props.leaseInfo.protocol}`]
            ?.amount ?? "0"
        );
      }
    }
  }

  const ticker =
    CurrencyDemapping[props.leaseInfo.leaseData?.leasePositionTicker]?.ticker ??
    props.leaseInfo.leaseData?.leasePositionTicker;

  return oracleStore.prices[`${ticker}@${props.leaseInfo.protocol}`]?.amount ?? "0";
});

async function fetchChartData(intetval: string) {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      let [key, protocol]: string[] = props.leaseInfo.leaseData?.leasePositionTicker?.includes("@")
        ? props.leaseInfo.leaseData.leasePositionTicker.split("@")
        : [props.leaseInfo.leaseData.leasePositionTicker, props.leaseInfo.protocol];
      const prices = await EtlApi.fetchPriceSeries(key, protocol, intetval);

      return prices;
    }
    case PositionTypes.short: {
      const lpn = AssetUtils.getLpnByProtocol(props.leaseInfo.protocol);
      let [key, protocol] = lpn.key.split("@");
      const prices = await EtlApi.fetchPriceSeries(key, protocol, intetval);

      return prices;
    }
  }
}

const asset = computed(() => {
  if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
    const item = app.currenciesData?.[props.leaseInfo.leaseData?.leasePositionTicker as string];
    return item;
  }

  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      const ticker =
        props.leaseInfo.leaseStatus?.opened?.amount.ticker ||
        props.leaseInfo.leaseStatus?.paid?.amount.ticker ||
        props.leaseInfo.leaseStatus?.opening?.downpayment.ticker;
      const item = AssetUtils.getCurrencyByTicker(ticker as string);

      const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
      return asset;
    }
    case PositionTypes.short: {
      const item = AssetUtils.getCurrencyByTicker(props.leaseInfo.leaseData.leasePositionTicker as string);

      const asset = AssetUtils.getCurrencyByDenom(item?.ibcData as string);
      return asset;
    }
  }
});

const getAssetIcon = computed((): string => {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
        return (
          (app.assetIcons?.[props.leaseInfo.leaseData?.leasePositionTicker as string] as string) ??
          app.assetIcons?.[`${props.leaseInfo.leaseStatus.opening.loan.ticker}@${props.leaseInfo.protocol}`]
        );
      }
      break;
    }
    case PositionTypes.short: {
      if (props.leaseInfo.leaseStatus?.opening && props.leaseInfo.leaseData) {
        return app.assetIcons?.[`${props.leaseInfo.leaseStatus.opening.loan.ticker}@${props.leaseInfo.protocol}`]!;
      }
    }
  }
  return app.assetIcons?.[`${props.leaseInfo.leaseData?.leasePositionTicker}@${props.leaseInfo.protocol}`] as string;
});

const downPayment = computed(() => {
  const amount = props.leaseInfo.leaseData?.downPayment;
  return amount?.toString(2);
});

const fee = computed(() => {
  const amount = props.leaseInfo.leaseData?.fee;
  return amount?.toString(2);
});

const amount = computed(() => {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      const data =
        props.leaseInfo.leaseStatus?.opened?.amount ||
        props.leaseInfo.leaseStatus.opening?.downpayment ||
        props.leaseInfo.leaseStatus.paid?.amount;
      return data?.amount ?? "0";
    }
    case PositionTypes.short: {
      const data =
        props.leaseInfo.leaseStatus?.opened?.amount ||
        props.leaseInfo.leaseStatus.opening?.downpayment ||
        props.leaseInfo.leaseStatus.paid?.amount;

      const asset =
        app.currenciesData?.[`${props.leaseInfo.leaseData.leasePositionTicker}@${props.leaseInfo.protocol}`]!;
      const lease_asset =
        app.currenciesData?.[`${props.leaseInfo.leaseData.ls_asset_symbol}@${props.leaseInfo.protocol}`]!;
      const price = oracleStore.prices?.[asset?.ibcData as string];
      return new Dec(data.amount, lease_asset.decimal_digits)
        .quo(new Dec(price.amount))
        .toString(lease_asset.decimal_digits);
    }
  }
});

const interestDue = computed(() => {
  const data = props.leaseInfo.leaseStatus?.opened;

  if (data) {
    const item = AssetUtils.getCurrencyByTicker(data.due_interest.ticker);

    const token = CurrencyUtils.convertMinimalDenomToDenom(
      props.leaseInfo.interestDue.truncate().toString(),
      item.ibcData,
      item!.symbol,
      Number(item!.decimal_digits)
    );
    return token.toDec().toString();
  }

  return "0";
});

const interest = computed(() => {
  return props.leaseInfo.interest.toString(2);
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

function onShowClaimDialog() {
  const data = props.leaseInfo.leaseStatus.paid as PaidLeaseInfo;
  if (data) showClaimDialog.value = true;

  const item = AssetUtils.getCurrencyByTicker(data.amount.ticker!);
  const token = CurrencyUtils.convertMinimalDenomToDenom(
    data.amount.amount,
    item.ibcData,
    item!.symbol,
    Number(item!.decimal_digits)
  );

  state.value.amount = token.toDec().toString() ?? "0";
  state.value.selectedCurrency = {
    balance: {
      amount: 0,
      denom: item.ibcData
    }
  };
}

async function onClaim() {
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

      const { txHash, txBytes, usedFee } = await leaseClient.simulateCloseLeaseTx(wallet, funds);

      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await walletStore.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      getLeases();
    } catch (e) {
      Logger.error(e);
      step.value = CONFIRM_STEP.ERROR;
    }
  }
}

async function onSendClick() {
  try {
    await walletOperation(onClaim);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

function onConfirmBackClick() {
  const close = claimDialog.value?.onModalClose;
  if (close) {
    close();
  }
  showClaimDialog.value = false;
}

function onClickOkBtn() {
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
    return `$${props.leaseInfo.liquidation.toString(4)}`;
  }
  return "$0";
});

const pnl = computed(() => {
  const lease = props.leaseInfo.leaseStatus.opened ?? props.leaseInfo.leaseStatus.paid;
  if (lease) {
    return {
      percent: props.leaseInfo.pnlPercent.toString(2),
      amount: CurrencyUtils.formatPrice(props.leaseInfo.pnlAmount.toString()),
      status: props.leaseInfo.pnlAmount.isPositive()
    };
  }

  return {
    percent: "0",
    amount: "0",
    status: false
  };
});

const copy = () => {
  StringUtils.copyToClipboard(props.leaseInfo.leaseAddress);
};

const openingSubState = computed(() => {
  const data = props.leaseInfo.leaseStatus.opening;
  if (OPENING_CHANNEL == data?.in_progress) {
    return [LeaseOpeningBarStatuses.CURRENT, "", ""];
  }

  const state = data?.in_progress as TransferOutOngoingState | BuyAssetOngoingState;

  if ((state as TransferOutOngoingState).transfer_out) {
    return [LeaseOpeningBarStatuses.READY, LeaseOpeningBarStatuses.CURRENT, ""];
  }

  if ((state as BuyAssetOngoingState).buy_asset) {
    return [LeaseOpeningBarStatuses.READY, LeaseOpeningBarStatuses.READY, LeaseOpeningBarStatuses.CURRENT];
  }

  return ["", "", ""];
});

const openingSubTitle = ["message.opening-channel", "message.transferring-assets", "message.swapping-assets"];

const openedSubState = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;
  if (data?.in_progress != null) {
    return true;
  }

  return false;
});

const loadingRepay = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "repayment")) {
    return true;
  }

  return false;
});

const loadingClose = computed(() => {
  const data = props.leaseInfo.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "close")) {
    return true;
  }

  return false;
});

const loadingCollect = computed(() => {
  const data = props.leaseInfo.leaseStatus.paid;

  if (data?.in_progress == "transfer_in_init" || data?.in_progress == "transfer_in_finish") {
    return true;
  }

  return false;
});

const interestDueStatus = computed(() => {
  const lease = props.leaseInfo.leaseStatus?.opened;
  if (lease) {
    const isDue = new Dec(LEASE_DUE).gte(new Dec(lease.overdue_collect_in));
    if (isDue) {
      return true;
    }
    return false;
  }
  return false;
});

const interestDueDate = computed(() => {
  const lease = props.leaseInfo.leaseStatus?.opened;
  let date = new Date();
  if (lease) {
    date = new Date(date.getTime() + lease.overdue_collect_in / 1000 / 1000);
  }
  return datePraser(date.toISOString(), true);
});

async function onShare() {
  showShareDialog.value = true;
}

const leaseOpenedMargin = ({
  overdue_interest,
  overdue_margin,
  principal_due,
  amount,
  due_margin,
  due_interest
}: OpenedLeaseInfo) => {
  const externalCurrencies = [overdue_interest, overdue_margin, due_margin, due_interest, principal_due, amount].map(
    (amount) => AssetUtils.getCurrencyByTicker(amount?.ticker as string)
  );

  const l = AssetUtils.getLpnByProtocol(props.leaseInfo.protocol);
  const price =
    oracleStore.prices[
      `${CurrencyDemapping[externalCurrencies[5].ticker]?.ticker ?? externalCurrencies[5].ticker}@${props.leaseInfo.protocol}`
    ];
  const marginPrice = oracleStore.prices[l.key];
  const priceAmount = new Dec(amount.amount, externalCurrencies[5].decimal_digits).mul(new Dec(price?.amount ?? 1));
  const margin = new Dec(overdue_interest.amount, externalCurrencies[0].decimal_digits)
    .add(new Dec(overdue_margin.amount, externalCurrencies[1].decimal_digits))
    .add(new Dec(due_margin.amount, externalCurrencies[2].decimal_digits))
    .add(new Dec(due_interest.amount, externalCurrencies[3].decimal_digits))
    .add(new Dec(principal_due.amount, externalCurrencies[4].decimal_digits));

  const margin_total = margin.mul(new Dec(marginPrice.amount));

  return margin_total.quo(priceAmount).mul(new Dec(100)).toString(2); // 100% is the max value
};

const leaseOpened = computed<LeaseProps>(() => ({
  // TODO: here we have click event which need to lead to history page with the hash as query param to load information in history table when this functionality is ready
  history: {
    value: `#${props.leaseInfo.leaseAddress.slice(-8)}`
  },
  title: {
    value: `${i18n.t(`message.${ProtocolsConfig[props.leaseInfo.protocol].type}`)} ${i18n.t("message.buy-position")}`,
    class: getTitleClass()
  },
  share: {
    label: i18n.t("message.share-position")
  },
  status: LeaseStatus.OPENED,
  tabs: [{ button: { icon: "icon-stats" } }, { button: { icon: "icon-lease-1" } }],
  actionButtons: {
    repay: { label: i18n.t("message.repay"), loading: loadingRepay.value, disabled: loadingClose.value },
    close: { label: i18n.t("message.close"), loading: loadingClose.value, disabled: loadingRepay.value }
  },
  progressBar: {
    title: i18n.t("message.health"),
    value: [`${leaseOpenedMargin(props.leaseInfo.leaseStatus.opened)}`]
  },
  progressDate: {
    title: i18n.t("message.opened-on"),
    value: props.leaseInfo.leaseData?.timestamp
      ? `${formatDate(props.leaseInfo.leaseData?.timestamp)?.toUpperCase()}`
      : ""
  },
  pnl: {
    click() {
      pnlType.value = !pnlType.value;
    },
    status: pnl.value.status ? LeasePnlStatus.POSITIVE : LeasePnlStatus.NEGATIVE
  },
  debt: {
    title: i18n.t("message.outstanding-loan"),
    tooltip: i18n.t("message.outstanding-debt-tooltip"),
    class: loadingRepay.value || loadingClose.value ? "h-5 mt-0.5 bg-neutral-100 rounded-md text-transparent pulse" : ""
  },
  interest: {
    title: i18n.t("message.interest-fee"),
    tooltip: i18n.t("message.interest-fee-tooltip")
  },
  interestDue: {
    title: i18n.t("message.interest-due"),
    tooltip: i18n.t("message.repay-interest", { dueDate: interestDueDate.value }),
    class: loadingRepay.value || loadingClose.value ? "h-5 mt-0.5 bg-neutral-100 rounded-md text-transparent pulse" : ""
  }
}));

const leaseOpening = computed<LeaseProps>(() => ({
  // TODO: here we have click event which need to lead to history page with the hash as query param to load information in history table when this functionality is ready
  history: {
    value: `#${props.leaseInfo.leaseAddress.slice(-8)}`
  },
  title: {
    value: `${i18n.t(`message.${ProtocolsConfig[props.leaseInfo.protocol].type}`)} ${i18n.t("message.buy-position")}`,
    class: getTitleClass()
  },
  status: LeaseStatus.OPENING,
  tabs: [{ button: { icon: "icon-stats" } }, { button: { icon: "icon-lease-1" } }],
  actionButtons: {
    repay: { label: i18n.t("message.repay"), loading: loadingRepay.value },
    close: { label: i18n.t("message.close"), loading: loadingClose.value }
  },
  progressBar: {
    title: i18n.t(openingSubTitle[openingSubState.value.findIndex((item) => item === LeaseOpeningBarStatuses.CURRENT)]),
    value: openingSubState.value
  },
  progressDate: {
    title: "",
    value: ""
  },
  debt: {
    title: i18n.t("message.outstanding-loan"),
    tooltip: i18n.t("message.outstanding-debt-tooltip"),
    class: "h-5 mt-0.5 bg-neutral-100 rounded-md text-transparent"
  },
  interest: {
    title: i18n.t("message.interest-fee"),
    tooltip: i18n.t("message.interest-fee-tooltip"),
    class: "h-5 mt-0.5 bg-neutral-100 rounded-md text-transparent"
  },
  interestDue: {
    title: i18n.t("message.interest-due"),
    tooltip: i18n.t("message.repay-interest", { dueDate: interestDueDate.value }),
    class: "h-5 mt-0.5 bg-neutral-100 rounded-md text-transparent"
  }
}));

const leasePaid = computed<LeaseProps>(() => ({
  // TODO: here we have click event which need to lead to history page with the hash as query param to load information in history table when this functionality is ready
  history: {
    value: `#${props.leaseInfo.leaseAddress.slice(-8)}`
  },
  title: {
    value: `${i18n.t(`message.${ProtocolsConfig[props.leaseInfo.protocol].type}`)} ${i18n.t("message.buy-position")}`,
    class: getTitleClass()
  },
  share: {
    label: i18n.t("message.share-position")
  },
  status: LeaseStatus.PAID,
  tabs: [{ button: { icon: "icon-stats", disabled: true } }, { button: { icon: "icon-lease-1" }, active: true }],
  actionButtons: {
    collect: { label: i18n.t("message.collect"), loading: loadingCollect.value, disabled: loadingCollect.value }
  },
  progressDate: {
    title: i18n.t("message.opened-on"),
    value: props.leaseInfo.leaseData?.timestamp
      ? `${formatDate(props.leaseInfo.leaseData?.timestamp)?.toUpperCase()}`
      : ""
  },
  pnl: {
    click() {
      pnlType.value = !pnlType.value;
    },
    status: pnl.value.status ? LeasePnlStatus.POSITIVE : LeasePnlStatus.NEGATIVE
  }
}));

function getTitleClass() {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      return "rounded border border-success-100 p-1 text-success-100";
    }
    case PositionTypes.short: {
      return "rounded border border-danger-100 p-1 text-danger-100";
    }
  }
}

const positionInStable = computed(() => {
  const amount =
    props.leaseInfo.leaseStatus?.opened?.amount ||
    props.leaseInfo.leaseStatus.opening?.downpayment ||
    props.leaseInfo.leaseStatus.paid?.amount;
  let protocol = props.leaseInfo.protocol;

  let ticker = props.leaseInfo.leaseData.leasePositionTicker;

  if (ticker.includes("@")) {
    let [t, p] = ticker.split("@");
    ticker = t;
    protocol = p;
  }

  if (CurrencyDemapping[ticker]) {
    ticker = CurrencyDemapping[ticker].ticker;
  }

  const asset = app.currenciesData?.[`${ticker}@${protocol}`];

  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      const price = oracleStore.prices?.[`${ticker}@${protocol}`];

      const value = new Dec(amount.amount, asset?.decimal_digits).mul(new Dec(price.amount));
      return value.toString(asset!.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : asset?.decimal_digits);
    }
    case PositionTypes.short: {
      const value = new Dec(amount.amount);
      return value.toString(asset!.decimal_digits > MAX_DECIMALS ? MAX_DECIMALS : asset?.decimal_digits);
    }
  }

  return "0";
});

function onFocusChart(data: string[], index: number) {
  if (index < 0) {
    focusPrice.value = null;
    return;
  }
  const dataSet = chartData.value.datasets[0].data;
  const value = dataSet[index];
  focusPrice.value = value[1].toString();
}

function getPrice() {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      return props.leaseInfo.leaseData?.price.toString(4);
    }
    case PositionTypes.short: {
      return props.leaseInfo.leaseData.lpnPrice.toString(4);
    }
  }

  ("0");
}

const leaseAsset = computed(() => {
  let ticker =
    CurrencyMapping[props.leaseInfo.leaseData.ls_asset_symbol]?.ticker ?? props.leaseInfo.leaseData.ls_asset_symbol;

  const asset = app.currenciesData?.[`${ticker}@${props.leaseInfo.protocol}`];
  return asset;
});

function getSharePrice() {
  switch (ProtocolsConfig[props.leaseInfo.protocol].type) {
    case PositionTypes.long: {
      return props.leaseInfo.leaseData?.price!.toString(6) ?? "0";
    }
    case PositionTypes.short: {
      return props.leaseInfo.leaseData.lpnPrice.toString(lpn.value.decimal_digits);
    }
  }
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
