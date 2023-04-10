-<template>
  <div class="col-span-12">
    <!-- Header -->
    <div class="table-header lg:flex block mt-[25px] flex-wrap items-center justify-between lg:px-0">
      <div class="left">
        <h1 class="text-20 nls-font-700 text-primary m-0 pb-3 lg:pb-0">
          {{ $t("message.assets") }}
        </h1>
      </div>

      <div class="right md:mt-0 inline-flex justify-end">
        <button
          class="btn btn-primary btn-large-primary"
          @click="openModal(DASHBOARD_ACTIONS.SEND)"
        >
          {{ $t("message.send-receive") }}
        </button>

        <button class="btn btn-secondary btn-large-secondary ml-4 hidden">
          {{ $t("message.buy-tokens") }}
        </button>
      </div>
    </div>
    <!-- Wallet -->
    <Transition :name="animate">
      <!-- v-if="isTotalBalancePositive" -->
      <div
        class="flex balance-box items-center justify-start background mt-6 shadow-box radius-medium radius-0-sm pt-6 pb-3 px-6 outline"
      >
        <div class="left inline-block pr-6">
          <p class="nls-font-500 text-16 text-primary">
            {{ $t("message.net-worth") }}
          </p>
          <CurrencyComponent
            :fontSize="40"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="totalBalance"
            :denom="NATIVE_CURRENCY.symbol"
            :has-space="false"
            :decimals="2"
            class="nls-font-700 text-primary"
          />
        </div>

        <div class="right flex w-2/3 -mt-8 lg:mt-0">
          <div class="pt-3 lg:pl-6">
            <p class="nls-font-500 text-12 text-dark-grey">
              {{ $t("message.available-assets") }}
            </p>

            <CurrencyComponent
              :fontSize="20"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="state.availableAssets.toString()"
              :denom="NATIVE_CURRENCY.symbol"
              :has-space="false"
              class="nls-font-500 text-primary"
            />
          </div>

          <div class="pt-3 pl-12 lg:pl-8">
            <p class="nls-font-500 text-12 text-dark-grey">
              {{ $t("message.active-leases") }}
            </p>

            <CurrencyComponent
              :fontSize="20"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="activeLeases.toString()"
              :denom="NATIVE_CURRENCY.symbol"
              :has-space="false"
              class="nls-font-500 text-primary"
            />
          </div>

          <!-- HIDDEN ON MOBILE -->
          <div class="pt-3 pl-12 lg:pl-8 hidden lg:block">
            <p class="nls-font-500 text-12 text-dark-grey">
              {{ $t("message.supplied-and-staked") }}
            </p>

            <CurrencyComponent
              :fontSize="20"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="suppliedAndStaked.toString()"
              :denom="NATIVE_CURRENCY.symbol"
              :has-space="false"
              class="nls-font-500 text-primary"
            />
          </div>

          <!-- HIDDEN ON DESKTOP -->
        </div>
        <div class="pt-4 block lg:hidden">
          <p class="nls-font-500 text-12 text-dark-grey">
            {{ $t("message.supplied-and-staked") }}
          </p>

          <CurrencyComponent
            :fontSize="20"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="suppliedAndStaked.toString()"
            :denom="NATIVE_CURRENCY.symbol"
            :has-space="false"
            class="nls-font-500 text-primary"
          />
        </div>
      </div>
    </Transition>

    <!-- Existing Assets -->
    <div
      class="block background mt-6 border-standart shadow-box radius-medium radius-0-sm outline"
      :class="{ 'async-loader': isAssetsLoading }"
    >
      <!-- Top -->
      <div class="flex flex-wrap items-baseline justify-between px-4 pt-6">
        <div class="left w-1/2">
          <p class="text-16 nls-font-500 dark-text pl-2">
            {{ $t("message.available-assets") }}
          </p>
        </div>
        <div class="right w-1/2 mt-0 inline-flex justify-end">
          <div class="relative block checkbox-container">
            <div class="flex items-center w-full justify-end">
              <input
                id="show-small-balances"
                v-model="state.showSmallBalances"
                aria-describedby="show-small-balances"
                name="show-small-balances"
                type="checkbox"
                @change="setSmallBalancesState(state.showSmallBalances)"
              />
              <label
                class="dark-text"
                for="show-small-balances"
              >{{
                $t("message.show-small-balances")
              }}</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets -->
      <div class="block mt-6 md:mt-[25px]">
        <!-- Assets Header -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-5">
          <div class="nls-font-500 text-12 text-left text-dark-grey text-upper">
            {{ $t("message.assets") }}
          </div>

          <div class="nls-font-500 text-dark-grey text-12 text-right text-upper">
            {{ $t("message.balance") }}
          </div>

          <div
            class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper"
          >
            <span class="inline-block">{{ $t("message.yield") }}</span>
            <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
          </div>

          <div
            class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper"
          >
            <span class="inline-block">{{ $t("message.lease-up-to") }}</span>
            <TooltipComponent :content="$t('message.lease-up-to-tooltip')" />
          </div>
        </div>

        <!-- Assets Container -->
        <div
          role="status"
          class="block lg:mb-0"
          :class="{ 'animate-pulse': loading }"
        >
          <template v-if="loading">
            <div
              v-for="index in getCurrenciesSize()"
              :key="index"
              class="h-[67px] flex items-center justify-between asset-partial nolus-box relative border-b border-standart py-3 px-4 items-center justify-between"
            >
              <div class="w-[50%] md:w-auto">
                <div class="w-32 h-1.5 bg-grey rounded-full mb-2.5"></div>
                <div class="h-1.5 bg-grey rounded-full w-24"></div>
              </div>
              <div class="flex flex-col items-end w-[50%] md:w-auto ml-8">
                <div class="w-32 h-1.5 bg-grey rounded-full mb-2.5"></div>
                <div class="h-1.5 bg-grey rounded-full w-24"></div>
              </div>
              <div class="h-1.5 bg-grey rounded-full w-12 hidden md:flex"></div>
              <div class="h-1.5 bg-grey rounded-full w-12 hidden md:flex"></div>
            </div>
          </template>
          <template v-else>
            <TransitionGroup
              name="fade"
              appear
              tag="div"
            >
              <AssetPartial
                v-for="(asset, index) in filteredAssets"
                :key="`${asset.balance.denom}-${index}`"
                :asset-info="getAssetInfo(asset.balance.denom)"
                :assetBalance="asset.balance.amount.toString()"
                :changeDirection="index % 2 === 0"
                :denom="asset.balance.denom"
                :price="getMarketPrice(asset.balance.denom)"
                :openModal="openModal"
                :earnings="DEFAULT_APR"
              />
            </TransitionGroup>
          </template>
        </div>
      </div>
    </div>

    <!-- Vested Assets -->
    <div
      v-if="vestedTokens.length > 0"
      class="block background mt-6 nls-border shadow-box radius-medium radius-0-sm outline"
    >
      <!-- Top -->
      <div class="flex flex-wrap items-baseline justify-between px-4 pt-6">
        <div class="left w-1/2">
          <p class="text-16 nls-font-500 dark-text">
            {{ $t("message.vested") }}
          </p>
        </div>
      </div>

      <!-- Assets -->
      <div class="block mt-6 md:mt-[25px]">
        <!-- Assets Header -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-6 border-b border-standart pb-3 px-6">
          <div class="nls-font-500 text-12 text-left text-dark-grey text-upper">
            {{ $t("message.assets") }}
          </div>

          <div class="hidden md:inline-flex items-center nls-font-500 text-12 text-right text-dark-grey text-upper">
            <span class="inline-block">{{ $t("message.release") }}</span>
          </div>

          <div class="nls-font-500 text-dark-grey text-12 text-right text-upper">
            {{ $t("message.balance") }}
          </div>
        </div>

        <!-- Assets Container -->
        <div class="block mb-6 lg:mb-0">
          <VestedAssetPartial
            v-for="(asset, index) in vestedTokens"
            :key="`${asset.amount.amount}-${index}`"
            :asset-info="getAssetInfo(asset.amount.denom)"
            :asset-balance="asset.amount.amount.toString()"
            :denom="asset.amount.denom"
            :end-time="asset.endTime"
          />
        </div>
      </div>
    </div>
  </div>

  <Modal
    v-if="state.showModal"
    :route="state.modalAction"
    @close-modal="state.showModal = false"
  >
    <component
      :is="modalOptions[state.modalAction]"
      :selectedAsset="state.selectedAsset"
    />
  </Modal>

  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import AssetPartial from "@/components/AssetPartial.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";
import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import SupplyWithdrawDialog from "@/components/modals/SupplyWithdrawDialog.vue";
import SendReceiveDialog from "@/components/modals/SendReceiveDialog.vue";
import LeaseDialog from "@/components/modals/LeaseDialog.vue";
import VestedAssetPartial from "@/components/VestedAssetPartial.vue";
import CurrencyComponent from "@/components/CurrencyComponent.vue";
import CURRENCIES from "@/config/currencies.json";

import type { AssetBalance } from "@/stores/wallet/state";
import { computed, ref, provide, onMounted, watch, onUnmounted, Transition } from "vue";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { DASHBOARD_ACTIONS } from "@/types/DashboardActions";
import { useLeases } from "@/composables";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { useOracleStore } from "@/stores/oracle";
import { DEFAULT_APR, NATIVE_CURRENCY } from "@/config/env";
import { storeToRefs } from "pinia";
import { LPN_CURRENCY } from "@/config/assetsInfo";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";

const modalOptions = {
  [DASHBOARD_ACTIONS.SEND]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.SUPPLY]: SupplyWithdrawDialog,
  [DASHBOARD_ACTIONS.LEASE]: LeaseDialog,
};
const smallBalancesStateKey = 'smallBalancesState';

const wallet = useWalletStore();
const oracle = useOracleStore();
const walletRef = storeToRefs(wallet);
const oracleRef = storeToRefs(oracle);

const isAssetsLoading = ref(wallet.balances.length == 0);
const showSkeleton = ref(wallet.balances.length == 0);

const showErrorDialog = ref(false);
const loaded = wallet.balances.length > 0 && Object.keys(oracle.prices).length > 0;
const animate = ref(loaded ? "" : "fade");
const errorMessage = ref("");
let timeout: NodeJS.Timeout;

const state = ref({
  showSmallBalances: localStorage.getItem(smallBalancesStateKey) ? false : true,
  showModal: false,
  modalAction: DASHBOARD_ACTIONS.SEND,
  selectedAsset: "",
  availableAssets: new Dec(0),
});

const vestedTokens = ref(
  [] as { endTime: string; amount: { amount: string; denom: string } }[]
);

const filteredAssets = computed(() => {
  return state.value.showSmallBalances
    ? wallet.balances
    : filterSmallBalances(wallet.balances as AssetBalance[]);
});

const loading = computed(() => showSkeleton.value || wallet.balances.length == 0);

const getCurrenciesSize = () => Object.keys(CURRENCIES.currencies).length

onMounted(() => {
  getVestedTokens();
  availableAssets();
  wallet[WalletActionTypes.LOAD_STAKED_TOKENS]();
  wallet[WalletActionTypes.LOAD_SUPPLIED_AMOUNT]();
  if (showSkeleton.value) {
    timeout = setTimeout(() => {
      showSkeleton.value = false;
    }, 400);
  }
});

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout);
  }
})

watch(walletRef.balances, () => {
  availableAssets();
});

watch(oracleRef.prices, () => {
  availableAssets();
});

const onClickTryAgain = async () => {
  getVestedTokens();
};

const getVestedTokens = async () => {
  vestedTokens.value = await wallet[WalletActionTypes.LOAD_VESTED_TOKENS]();
};

const totalBalance = computed(() => {
  let total = state.value.availableAssets;
  total = total.add(activeLeases.value as Dec);
  total = total.add(suppliedAndStaked.value);
  return total.toString();
});

const isTotalBalancePositive = computed(() => {
  let total = state.value.availableAssets;
  total = total.add(activeLeases.value);
  total = total.add(suppliedAndStaked.value);
  return total.gt(new Dec(0));
});

const { leases, getLeases } = useLeases(
  (error: Error | any) => { },
  () => { }
);

provide("getLeases", getLeases);

const activeLeases = computed(() => {
  let totalLeases = new Dec(0);

  leases.value.forEach((lease) => {
    if (lease.leaseStatus.opened) {
      const ticker = lease.leaseStatus.opened.amount.ticker;
      const currency = wallet.getCurrencyByTicker(ticker);
      const ibcDenom = wallet.getIbcDenomBySymbol(currency.symbol) as string;
      const data = wallet.getCurrencyInfo(ibcDenom as string);

      const balance = CurrencyUtils.calculateBalance(
        getMarketPrice(ibcDenom),
        new Coin(data.coinDenom, lease.leaseStatus.opened.amount.amount),
        data.coinDecimals
      );

      totalLeases = totalLeases.add(balance.toDec());
    }
  });

  return totalLeases;
});

const availableAssets = () => {
  let totalAssets = new Dec(0);
  wallet.balances.forEach((asset) => {
    const { coinDecimals, coinDenom } = wallet.getCurrencyInfo(
      asset.balance.denom
    );

    const assetBalance = CurrencyUtils.calculateBalance(
      getMarketPrice(asset.balance.denom),
      new Coin(coinDenom, asset.balance.amount.toString()),
      coinDecimals
    );

    totalAssets = totalAssets.add(assetBalance.toDec());
  });

  state.value.availableAssets = totalAssets;

  if (animate.value.length > 0 && totalAssets.gt(new Dec(0))) {
    setTimeout(() => {
      animate.value = "";
    }, 400);
  }
};

const suppliedAndStaked = computed(() => {
  const staking = wallet.stakingBalance as Coin;
  const supplied = wallet.suppliedBalance;
  const suppliedSymbol = wallet.getCurrencyByTicker(LPN_CURRENCY.key);
  const suppliedCoin = wallet.getIbcDenomBySymbol(
    suppliedSymbol.symbol
  ) as string;
  const suppliedInfo = wallet.getCurrencyInfo(suppliedCoin as string);
  let totalSuppliedAndStaked = new Dec(0);

  const suppliedBalance = CurrencyUtils.calculateBalance(
    getMarketPrice(suppliedCoin),
    new Coin(suppliedCoin, supplied),
    suppliedInfo.coinDecimals
  );
  totalSuppliedAndStaked = totalSuppliedAndStaked.add(suppliedBalance.toDec());

  if (staking) {
    const stakingInfo = wallet.getCurrencyInfo(staking.denom as string);
    const stakingBalance = CurrencyUtils.calculateBalance(
      getMarketPrice(staking.denom),
      staking,
      stakingInfo.coinDecimals
    );
    totalSuppliedAndStaked = totalSuppliedAndStaked.add(stakingBalance.toDec());
  }

  return totalSuppliedAndStaked;
});

const filterSmallBalances = (balances: AssetBalance[]) => {
  return balances.filter((asset) => asset.balance.amount.gt(new Int("1")));
};

const openModal = (action: DASHBOARD_ACTIONS, denom = "") => {
  state.value.selectedAsset = denom;
  state.value.modalAction = action;
  state.value.showModal = true;
};

const getAssetInfo = (denom: string) => {
  return wallet.getCurrencyInfo(denom);
};

const getMarketPrice = (denom: string) => {
  const item = wallet.currencies[denom];
  const price = oracle.prices?.[item?.symbol]?.amount ?? "0";

  return price;
};

const setSmallBalancesState = (event: boolean) => {
  if(!event){
    localStorage.setItem(smallBalancesStateKey, 'false');
  }else{
    localStorage.removeItem(smallBalancesStateKey);
  }
}
</script>
<style scoped lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}</style>
