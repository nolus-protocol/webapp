<template>
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
    <div v-if="isTotalBalancePositive"
    class="flex balance-box items-center justify-start background mt-6 nls-border shadow-box radius-medium radius-0-sm pt-6 pb-3 px-6"
    >
      <template>
        <div class="left inline-block w-1/3">
          <p class="nls-font-500 text-16 text-primary">
            {{ $t("message.total") }}
          </p>
          <p class="nls-font-700 text-32 lg:text-40 text-primary">
            {{ totalBalance }}
          </p>
          <div class="separator-line flex py-4 lg:hidden ml-[-16px] mr-[-16px]"></div>
        </div>

        <div class="border-right h-[80px] mt-[-48px] hidden md:flex"></div>
        <div class="border-right h-[80px] mb-[-24px] ml-[-1px] hidden md:flex"></div>
      </template>

      <div class="right flex w-2/3 -mt-8 lg:mt-0">
        <div class="pt-3 lg:pl-6">
          <p class="nls-font-400 text-12 text-dark-grey">
            {{ $t("message.available-assets") }}
          </p>

          <p class="nls-font-500 text-20 dark-text">
            {{ availableAssets }}
          </p>
        </div>

        <div class="pt-3 pl-12 lg:pl-8">
          <p class="nls-font-400 text-12 text-dark-grey">
            {{ $t("message.active-leases") }}
          </p>

          <p class="nls-font-500 text-20 dark-text">
            {{ activeLeases }}
          </p>
        </div>

        <!-- HIDDEN ON MOBILE -->
        <div class="pt-3 pl-12 lg:pl-8 hidden lg:block">
          <p class="nls-font-400 text-12 text-dark-grey">
            {{ $t("message.supplied-and-staked") }}
          </p>
          <p class="nls-font-500 text-20 dark-text">
            {{ suppliedAndStaked }}
          </p>
        </div>

        <!-- HIDDEN ON DESKTOP -->
      </div>
      <div class="pt-4 block lg:hidden">
        <p class="nls-font-400 text-12 text-dark-grey">
          {{ $t("message.supplied-and-staked") }}
        </p>

        <p class="nls-font-500 text-20 dark-text">
          {{ suppliedAndStaked }}
        </p>
      </div>
    </div>

    <!-- Existing Assets -->
    <div
      class="block background mt-6 border-standart shadow-box radius-medium radius-0-sm"
      :class="{'async-loader': isAssetsLoading}"
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
              />
              <label class="dark-text" for="show-small-balances">{{
                $t("message.show-small-balances")
              }}</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets -->
      <div class="block mt-6 md:mt-[25px]">
        <!-- Assets Header -->
        <div
          class="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6"
        >
          <div class="nls-font-500 text-12 text-left text-dark-grey text-upper">
            {{ $t("message.assets") }}
          </div>

          <div
            class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper"
          >
            <span class="inline-block">{{ $t("message.lease-up-to") }}</span>
            <TooltipComponent content="Content goes here" />
          </div>

          <div
            class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper"
          >
            <span class="inline-block">{{ $t("message.earn-apr") }}</span>
            <TooltipComponent content="Content goes here" />
          </div>

          <div
            class="nls-font-500 text-dark-grey text-12 text-right text-upper"
          >
            {{ $t("message.balance") }}
          </div>
        </div>

        <!-- Assets Container -->
        <div class="block lg:mb-0">
          <AssetPartial
            v-for="(asset, index) in manipulatedAssets"
            :key="`${asset.balance.denom}-${index}`"
            :asset-info="getAssetInfo(asset.balance.denom)"
            :assetBalance="asset.balance.amount.toString()"
            :changeDirection="index % 2 === 0"
            :denom="asset.balance.denom"
            :price="getMarketPrice(asset.balance.denom)"
            :openModal="openModal"
            :earnings="DEFAULT_APR"
          />
        </div>
      </div>
      
    </div>

     <!-- Vested Assets -->
    <div
      v-if="vestedTokens.length > 0"
      class="block background mt-6 nls-border shadow-box radius-medium radius-0-sm"
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
        <div
          class="grid grid-cols-3 md:grid-cols-3 gap-6 border-b border-standart pb-3 px-6"
        >
          <div class="nls-font-500 text-12 text-left text-dark-grey text-upper">
            {{ $t("message.assets") }}
          </div>

          <div
            class="inline-flex items-center nls-font-500 text-12 text-right text-dark-grey text-upper"
          >
            <span class="inline-block">{{ $t("message.release") }}</span>
          </div>

          <div
            class="nls-font-500 text-dark-grey text-12 text-right text-upper"
          >
            {{ $t("message.balance") }}
          </div>
        </div>

        <!-- Assets Container -->
        <div class="block mb-10 lg:mb-0">
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

  <Modal v-if="state.showModal" @close-modal="state.showModal = false" :route="state.modalAction">
    <component
      :is="modalOptions[state.modalAction]"
      :selectedAsset="state.selectedAsset"
    />
  </Modal>

  <Modal v-if="showErrorDialog" @close-modal="showErrorDialog = false" route="alert">
    <ErrorDialog
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import AssetPartial from '@/components/AssetPartial.vue';
import TooltipComponent from '@/components/TooltipComponent.vue';
import Modal from '@/components/modals/templates/Modal.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import SupplyWithdrawDialog from '@/components/modals/SupplyWithdrawDialog.vue';
import SendReceiveDialog from '@/components/modals/SendReceiveDialog.vue';
import LeaseDialog from '@/components/modals/LeaseDialog.vue';
import VestedAssetPartial from '@/components/VestedAssetPartial.vue';

import type { AssetBalance } from '@/stores/wallet/state';
import { AssetUtils } from '@/utils/AssetUtils';
import { computed, ref, provide, onMounted, onUnmounted } from 'vue';
import { Coin, Dec, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import { DASHBOARD_ACTIONS } from '@/types/DashboardActions';
import { useLeases } from '@/composables';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';
import { OracleActionTypes, useOracleStore } from '@/stores/oracle';
import { WalletManager } from '@/wallet/WalletManager';
import { DEFAULT_APR, UPDATE_BALANCE_INTERVAL, UPDATE_PRICES_INTERVAL } from '@/config/env';

const modalOptions = {
  [DASHBOARD_ACTIONS.SEND]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.SUPPLY]: SupplyWithdrawDialog,
  [DASHBOARD_ACTIONS.LEASE]: LeaseDialog
};

const wallet = useWalletStore();
const oracle = useOracleStore();
const isAssetsLoading = ref(wallet.balances.length == 0);
const showErrorDialog = ref(false);
const errorMessage = ref('');

let balanceInterval: NodeJS.Timeout | undefined;
let pricesInterval: NodeJS.Timeout | undefined;

const state = ref({
  showSmallBalances: true,
  showModal: false,
  modalAction: DASHBOARD_ACTIONS.SEND,
  selectedAsset: '',
  availableAssets: new Dec(0),
  activeLeases: new Dec(0),
  suppliedAndStaked: new Dec(0),
});

const vestedTokens = ref([] as { delayed: boolean, endTime: string, toAddress: string, amount: { amount: string, denom: string } }[]);
const mainAssets = computed(() => wallet.balances);
const manipulatedAssets = computed(() => {
    return state.value.showSmallBalances ? mainAssets.value : filterSmallBalances(mainAssets.value as AssetBalance[])
  }
);

onMounted(async () => {
  getVestedTokens();
  await loadNetwork();
});

onUnmounted(() => {
  clearInterval(balanceInterval);
  clearInterval(pricesInterval);
})

const onClickTryAgain = async () => {
  await loadNetwork();
};

const loadNetwork = async () => {
  try {
    await Promise.all([
      wallet[WalletActionTypes.UPDATE_BALANCES](),
      oracle[OracleActionTypes.GET_PRICES]()
    ]);
    checkBalances();
    checkPrices();
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
};

const checkBalances = async () => {
  balanceInterval = setInterval(async () => {
    try {
      if (WalletManager.getWalletAddress() !== '') {
        await wallet[WalletActionTypes.UPDATE_BALANCES]();
      }
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_BALANCE_INTERVAL);
};

const checkPrices = async () => {
   pricesInterval = setInterval(async () => {
    try {
      await oracle[OracleActionTypes.GET_PRICES]();
    } catch (error: Error | any) {
      showErrorDialog.value = true;
      errorMessage.value = error?.message;
    }
  }, UPDATE_PRICES_INTERVAL);
};

const getVestedTokens = async () => {
  vestedTokens.value = await wallet[WalletActionTypes.LOAD_VESTED_TOKENS]();
};

const totalBalance = computed(() => {
  let total = state.value.availableAssets;
  total = total.add(state.value.activeLeases as Dec);
  total = total.add(state.value.suppliedAndStaked as Dec);

  return CurrencyUtils.formatPrice(total.toString()).toString();
});

const isTotalBalancePositive = computed(() => {
  let total = state.value.availableAssets;
  total = total.add(state.value.activeLeases as Dec);
  total = total.add(state.value.suppliedAndStaked as Dec);
  return total.gt(new Dec(0));
});

const { leases, getLeases } = useLeases((error: Error | any) => {});

provide('getLeases', getLeases);

const activeLeases = computed(() => {
  let totalLeases = new Dec(0);

  leases.value.forEach((lease) => {

    if (lease.leaseStatus.opened) {
      const denom = lease.leaseStatus.opened.amount.ticker;
      const balance = CurrencyUtils.calculateBalance(
        getMarketPrice(denom),
        new Coin(denom, lease.leaseStatus.opened.amount.amount),
        0
      );

      totalLeases = totalLeases.add(balance.toDec());
    }

  });

  state.value.activeLeases = totalLeases;
  return CurrencyUtils.formatPrice(totalLeases.toString()).toString();
});

const availableAssets = computed(() => {
  let totalAssets = new Dec(0);

  mainAssets.value.forEach((asset) => {

    const { coinDecimals, coinDenom } = AssetUtils.getAssetInfoByAbbr(
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
  return CurrencyUtils.formatPrice(totalAssets.toString()).toString();
});

const suppliedAndStaked = computed(() => {
  // // @TODO: get suppliedAndStaked
  const totalSuppliedAndStaked = new Dec(0);
  state.value.suppliedAndStaked = totalSuppliedAndStaked;
  return CurrencyUtils.formatPrice(
    totalSuppliedAndStaked.toString()
  ).toString();
});

const filterSmallBalances = (balances: AssetBalance[]) => {
  return balances.filter((asset) => asset.balance.amount.gt(new Int('1')));
}

const openModal = (action: DASHBOARD_ACTIONS, denom = '') => {
  state.value.selectedAsset = denom;
  state.value.modalAction = action;
  state.value.showModal = true;
}

const getAssetInfo = (denom: string) => {
  return wallet.getCurrencyInfo(denom);
}

const getMarketPrice = (denom: string) => {
  const item = wallet.currencies[denom];
  const price = oracle.prices?.[item?.symbol]?.amount ?? '0';

  return price;
}

</script>
