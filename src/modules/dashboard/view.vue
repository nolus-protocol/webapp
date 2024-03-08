<template>
  <div class="mt-[25px]">
    <BannerComponent />
    <div class="col-span-12">
      <!-- Wallet -->
      <Transition :name="animate">
        <!-- v-if="isTotalBalancePositive" -->
        <div
          class="balance-box background shadow-box radius-medium mt-6 flex flex-col justify-start p-4 outline lg:items-baseline lg:p-6"
        >
          <p class="nls-font-500 mb-1.5 text-16 text-primary md:mb-6">
            {{ $t("message.portfolio-title") }}
          </p>
          <div class="border-standart mb-4 flex w-full flex-col gap-8 border-b pb-4 md:mb-6 md:flex-row md:pb-6">
            <div
              v-show="!totalBalance.isZero()"
              class="hidden md:block"
            >
              <!-- Chart Component here -->
              <DashboardDaughnutChart ref="statChart" />
            </div>

            <div class="flex flex-col">
              <div>
                <p class="nls-font-500 text-dark-grey text-12">
                  {{ $t("message.portfolio-value") }}
                </p>
                <CurrencyComponent
                  :amount="totalBalance.toString()"
                  :decimals="2"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="40"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-700 text-primary"
                />
              </div>

              <div class="">
                <p class="nls-font-500 text-dark-grey text-12">
                  {{ $t("message.total-equity") }}
                </p>

                <CurrencyComponent
                  :amount="totalEquity.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>
            </div>
          </div>

          <div class="flex w-full flex-col pb-2 md:flex-row lg:mt-0">
            <div class="flex">
              <div class="pr-8 lg:pr-0">
                <p class="nls-font-500 text-dark-grey text-12">
                  {{ $t("message.active-leases") }}
                </p>

                <CurrencyComponent
                  :amount="activeLeases.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>

              <div class="lg:pl-8">
                <p class="nls-font-500 text-dark-grey text-12">
                  {{ $t("message.outstanding-loan") }}
                </p>

                <CurrencyComponent
                  :amount="debt.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>
            </div>

            <div
              class="border-standart mb-4 border-b pb-4 pt-4 md:mb-0 md:border-b-0 md:border-r md:pb-0 md:pl-8 md:pr-8 md:pt-0"
            >
              <p class="nls-font-500 text-dark-grey text-12">
                {{ $t("message.positions-pnL") }}
              </p>

              <CurrencyComponent
                :amount="pnl.abs().toString()"
                :class="pnl.isZero() ? 'text-primary' : pnl.isPositive() ? '!text-[#1AB171]' : 'text-[#E42929]'"
                :denom="`${pnl.isZero() ? '' : pnl.isPositive() ? '+' : '-'}${NATIVE_CURRENCY.symbol}`"
                :fontSize="20"
                :fontSizeSmall="14"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="nls-font-500"
              />
            </div>

            <div class="flex">
              <div class="pl-0 pr-8 md:pl-8 md:pr-0">
                <p class="nls-font-500 text-dark-grey text-12">
                  {{ $t("message.supplied-and-staked") }}
                </p>

                <CurrencyComponent
                  :amount="earnings.toString()"
                  :denom="NATIVE_CURRENCY.symbol"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500 text-primary"
                />
              </div>

              <div class="md:pl-8">
                <p class="nls-font-500 text-dark-grey text-12">
                  {{ $t("message.rewards") }}
                </p>
                <CurrencyComponent
                  :amount="rewards.abs().toString()"
                  :class="
                    rewards.isZero() ? 'text-primary' : rewards.isPositive() ? '!text-[#1AB171]' : 'text-[#E42929]'
                  "
                  :denom="`${rewards.isZero() ? '' : rewards.isPositive() ? '+' : '-'}${NATIVE_CURRENCY.symbol}`"
                  :fontSize="20"
                  :fontSizeSmall="14"
                  :has-space="false"
                  :prettyZeros="true"
                  :type="CURRENCY_VIEW_TYPES.CURRENCY"
                  class="nls-font-500"
                />
              </div>
            </div>

            <!-- HIDDEN ON DESKTOP -->
          </div>
        </div>
      </Transition>

      <!-- Existing Assets -->
      <div
        :class="{ 'async-loader': isAssetsLoading }"
        class="background border-standart shadow-box mt-6 block p-4 outline lg:rounded-xl lg:p-6"
      >
        <!-- Top -->
        <div class="flex flex-wrap items-baseline justify-between">
          <div class="left w-1/3">
            <p class="nls-font-500 dark-text text-16">
              {{ $t("message.available-assets") }}
            </p>
          </div>
          <div class="right mt-0 inline-flex w-2/3 justify-end">
            <div class="checkbox-container relative block"></div>
          </div>
        </div>

        <!-- Assets -->
        <div class="mt-6 block md:mt-[25px]">
          <!-- Assets Header -->
          <div class="border-standart grid grid-cols-4 gap-6 border-b pb-3 md:grid-cols-5">
            <div class="nls-font-500 text-dark-grey text-upper col-span-2 text-left text-12 md:col-span-1">
              {{ $t("message.assets") }}
            </div>

            <div class="nls-font-500 text-dark-grey text-upper text-right text-12">
              {{ $t("message.balance") }}
            </div>

            <div
              class="nls-font-500 text-dark-grey text-upper hidden items-center justify-end text-right text-12 md:inline-flex"
            >
              <span class="inline-block">{{ $t("message.yield") }}</span>
              <TooltipComponent :content="$t('message.earn-apr-tooltip')" />
            </div>

            <div
              class="nls-font-500 text-dark-grey text-upper hidden items-center justify-end text-right text-12 md:inline-flex"
            >
              <span class="inline-block">{{ $t("message.lease-up-to") }}</span>
              <TooltipComponent :content="$t('message.lease-up-to-tooltip')" />
            </div>

            <div
              class="nls-font-500 text-dark-grey text-upper items-center justify-end text-right text-12 md:inline-flex"
            >
              <span class="inline-block">{{ $t("message.receive/send") }}</span>
            </div>
          </div>

          <!-- Assets Container -->
          <div
            :class="{ 'animate-pulse': loading }"
            class="block lg:mb-0"
            role="status"
          >
            <template v-if="loading">
              <div
                v-for="index in currenciesSize"
                :key="index"
                class="asset-partial nolus-box border-standart relative flex h-[67px] items-center items-center justify-between justify-between border-b px-4 py-3"
              >
                <div class="w-[50%] md:w-auto">
                  <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
                  <div class="h-1.5 w-24 rounded-full bg-grey"></div>
                </div>
                <div class="ml-8 flex w-[50%] flex-col items-end md:w-auto">
                  <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
                  <div class="h-1.5 w-24 rounded-full bg-grey"></div>
                </div>
                <div class="hidden h-1.5 w-12 rounded-full bg-grey md:flex"></div>
                <div class="hidden h-1.5 w-12 rounded-full bg-grey md:flex"></div>
              </div>
            </template>
            <template v-else>
              <TransitionGroup
                appear
                name="fade"
                tag="div"
              >
                <AssetPartial
                  v-for="(asset, index) in filteredAssets"
                  :key="`${asset.balance.denom}-${index}`"
                  :asset-info="getAssetInfo(asset.balance.denom)"
                  :assetBalance="
                    asset.balance.denom == wallet.available.denom
                      ? wallet.available.amount.toString()
                      : asset.balance.amount.toString()
                  "
                  :changeDirection="index % 2 === 0"
                  :denom="asset.balance.denom"
                  :earnings="DEFAULT_APR"
                  :openModal="openModal"
                  :price="oracle.prices[asset.balance.denom]?.amount ?? '0'"
                  :sendReceiveOpen="sendReceiveOpen"
                />
              </TransitionGroup>
            </template>
          </div>

          <div class="flex justify-center pb-[18px] pt-[8px]">
            <button
              class="btn transfer btn-medium-secondary"
              @click="setCurrency()"
            >
              {{ state.showSmallBalances ? $t("message.hide-small-balances") : $t("message.show-small-balances") }}
            </button>
          </div>
        </div>
      </div>

      <!-- Vested Assets -->
      <div
        v-if="vestedTokens.length > 0"
        class="background shadow-box radius-medium mt-6 block outline"
      >
        <!-- Top -->
        <div class="flex flex-wrap items-baseline justify-between px-4 pt-6">
          <div class="left w-1/2">
            <p class="nls-font-500 dark-text text-16">
              {{ $t("message.vested") }}
            </p>
          </div>
        </div>

        <!-- Assets -->
        <div class="mt-6 block md:mt-[25px]">
          <!-- Assets Header -->
          <div class="border-standart grid grid-cols-2 gap-6 border-b px-6 pb-3 md:grid-cols-3">
            <div class="nls-font-500 text-dark-grey text-upper text-left text-12">
              {{ $t("message.assets") }}
            </div>

            <div class="nls-font-500 text-dark-grey text-upper hidden items-center text-right text-12 md:inline-flex">
              <span class="inline-block">{{ $t("message.release") }}</span>
            </div>

            <div class="nls-font-500 text-dark-grey text-upper text-right text-12">
              {{ $t("message.balance") }}
            </div>
          </div>

          <!-- Assets Container -->
          <div class="mb-6 block lg:mb-0">
            <VestedAssetPartial
              v-for="(asset, index) in vestedTokens"
              :key="`${asset.amount.amount}-${index}`"
              :asset-balance="wallet.vestTokens.amount.toString()"
              :asset-info="getAssetInfo(asset.amount.denom)"
              :denom="asset.amount.denom"
              :end-time="asset.endTime"
            />
          </div>
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
      :dialogSelectedCurrency="state.dialogSelectedCurrency"
      :selectedAsset="state.selectedAsset"
    />
  </Modal>

  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import { AssetPartial, BannerComponent, DashboardDaughnutChart, VestedAssetPartial } from "./components";
import { DASHBOARD_ACTIONS } from "./types";

import TooltipComponent from "@/common/components/TooltipComponent.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";
import SendReceiveDialog from "@/common/components/modals/SendReceiveDialog.vue";
import SupplyWithdrawDialog from "@/common/components/modals/SupplyWithdrawDialog.vue";
import LeaseDialog from "@/common/components/modals/LeaseDialog.vue";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

import { CURRENCY_VIEW_TYPES } from "@/common/types";
import type { AssetBalance } from "@/common/stores/wallet/types";

import { computed, onUnmounted, provide, ref, Transition, watch } from "vue";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { useLeases } from "@/common/composables/useLeases";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { useAdminStore } from "@/common/stores/admin";

import { AssetUtils, Logger, NetworkUtils, WalletManager } from "@/common/utils";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { DEFAULT_APR, IGNORE_TRANSFER_ASSETS, LPN_DECIMALS, NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";

const modalOptions = {
  [DASHBOARD_ACTIONS.SEND]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.RECEIVE]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.SUPPLY]: SupplyWithdrawDialog,
  [DASHBOARD_ACTIONS.LEASE]: LeaseDialog
};

const smallBalancesStateKey = "smallBalancesState";
const statChart = ref<typeof DashboardDaughnutChart>();

const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const admin = useAdminStore();

const isAssetsLoading = ref(wallet.balances.length == 0);
const showSkeleton = ref(wallet.balances.length == 0);

const showErrorDialog = ref(false);
const loaded = wallet.balances.length > 0 && Object.keys(oracle.prices).length > 0;
const animate = ref(loaded ? "" : "fade");
const errorMessage = ref("");
const earnings = ref(new Dec(0));
const debt = ref(new Dec(0));
const activeLeases = ref(new Dec(0));
const pnl = ref(new Dec(0));
const rewards = ref(new Dec(0));

let timeout: NodeJS.Timeout;

const state = ref({
  showSmallBalances: localStorage.getItem(smallBalancesStateKey) ? false : true,
  showModal: false,
  modalAction: DASHBOARD_ACTIONS.SEND,
  selectedAsset: "",
  dialogSelectedCurrency: "",
  setAvailableAssets: new Dec(0)
});

const vestedTokens = ref([] as { endTime: string; amount: { amount: string; denom: string } }[]);

const totalEquity = computed(() => {
  return totalBalance.value.sub(debt.value as Dec);
});

const filteredAssets = computed(() => {
  const b = wallet.balances.filter((currency) => {
    const c = wallet.getCurrencyInfo(currency.balance.denom);
    if (IGNORE_TRANSFER_ASSETS.includes(c.ticker as string)) {
      return false;
    }
    return true;
  });
  const balances = state.value.showSmallBalances ? b : filterSmallBalances(b as AssetBalance[]);
  return balances.sort((a, b) => {
    const aInfo = wallet.getCurrencyInfo(a.balance.denom);
    const aAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[a.balance.denom]?.amount,
      new Coin(a.balance.denom, a.balance.amount.toString()),
      aInfo.coinDecimals as number
    ).toDec();

    const bInfo = wallet.getCurrencyInfo(b.balance.denom);
    const bAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[b.balance.denom]?.amount,
      new Coin(b.balance.denom, b.balance.amount.toString()),
      bInfo.coinDecimals as number
    ).toDec();

    return Number(bAssetBalance.sub(aAssetBalance).toString(8));
  });
});

const loading = computed(() => showSkeleton.value || wallet.balances.length == 0);
const currenciesSize = computed(() => Object.keys(app.currenciesData ?? {}).length);
const { leases, getLeases } = useLeases((error: Error | any) => {});

provide("getLeases", getLeases);

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout);
  }
});

watch(
  () => [wallet.wallet, oracle.prices],
  async () => {
    try {
      await Promise.all([setVestedTokens(), setAvailableAssets(), loadSuppliedAndStaked(), setRewards()]);
      if (showSkeleton.value) {
        timeout = setTimeout(() => {
          showSkeleton.value = false;
        }, 400);
      }
    } catch (e) {
      Logger.error(e);
    }
  },
  {
    immediate: true
  }
);

watch(
  () => leases.value,
  () => {
    setLeases();
  }
);

watch(
  () => wallet.wallet,
  () => {
    getLeases();
  }
);

watch(
  () => [wallet.balances],
  () => {
    setAvailableAssets();
  }
);

async function onClickTryAgain() {}

async function setVestedTokens() {
  vestedTokens.value = await wallet.LOAD_VESTED_TOKENS();
}

const totalBalance = computed(() => {
  let total = state.value.setAvailableAssets;
  total = total.add(activeLeases.value as Dec);
  total = total.add(earnings.value as Dec);

  return total;
});

function setAvailableAssets() {
  let totalAssets = new Dec(0);
  wallet.balances.forEach((asset) => {
    const currency = wallet.currencies[asset.balance.denom];
    const assetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[asset.balance.denom]?.amount ?? 0,
      new Coin(currency.ibcData, asset.balance.amount.toString()),
      Number(currency.decimal_digits)
    );
    totalAssets = totalAssets.add(assetBalance.toDec());
  });

  state.value.setAvailableAssets = totalAssets;

  if (animate.value.length > 0 && totalAssets.gt(new Dec(0))) {
    setTimeout(() => {
      animate.value = "";
    }, 400);
  }
}

async function loadSuppliedAndStaked() {
  const supplied = async () => {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    let amount = new Dec(0);

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const lppClient = new Lpp(cosmWasmClient, admin.contracts![protocolKey].lpp);
        const lppConfig = await lppClient.getLppConfig();
        const lpnCoin = app.getCurrencySymbol(lppConfig.lpn_ticker, protocolKey);
        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);

        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        amount = amount.add(new Dec(depositBalance.balance, Number(lpnCoin!.decimal_digits)).mul(calculatedPrice));
      };

      promises.push(fn());
    }

    await Promise.all(promises);

    return amount;
  };

  const delegated = async () => {
    const delegations = await NetworkUtils.loadDelegations();
    const nativeAsset = AssetUtils.getAssetInfo(NATIVE_ASSET.ticker);
    let v = new Dec(0);

    for (const item of delegations) {
      const p = AssetUtils.getPriceByDenom(item.balance.amount, nativeAsset.coinMinimalDenom);
      v = v.add(p);
    }

    return v;
  };

  await Promise.all([supplied(), delegated()])
    .then(([a, b]) => {
      let value = new Dec(0);
      value = value.add(a);
      value = value.add(b);
      earnings.value = value;
    })
    .catch((e) => Logger.error(e));
}

function filterSmallBalances(balances: AssetBalance[]) {
  return balances.filter((asset) => asset.balance.amount.gt(new Int("1")));
}

function openModal(action: DASHBOARD_ACTIONS, denom = "") {
  state.value.dialogSelectedCurrency = "";
  state.value.selectedAsset = denom;
  state.value.modalAction = action;
  state.value.showModal = true;
}

function getAssetInfo(denom: string) {
  return wallet.getCurrencyInfo(denom);
}

function setCurrency() {
  state.value.showSmallBalances = !state.value.showSmallBalances;
  setSmallBalancesState(state.value.showSmallBalances);
}

function setSmallBalancesState(event: boolean) {
  if (!event) {
    localStorage.setItem(smallBalancesStateKey, "false");
  } else {
    localStorage.removeItem(smallBalancesStateKey);
  }
}

function sendReceiveOpen(currency: string) {
  state.value.selectedAsset = "";
  state.value.dialogSelectedCurrency = currency;
  state.value.modalAction = DASHBOARD_ACTIONS.RECEIVE;
  state.value.showModal = true;
}

function strToColor(str: string) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 10) - hash);
    hash = hash & hash;
  }
  let rgb = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 255;
    rgb[i] = value;
  }

  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

async function setChartData() {
  const labels: string[] = [];
  const colors: string[] = [];
  const dataValue: string[] = [];
  const assets: string[] = [];

  const balances = wallet.balances;

  balances.filter((item) => {
    const currencyInfo = wallet.getCurrencyInfo(item.balance.denom);
    const coin = new Coin(item.balance.denom, item.balance.amount);
    const balance = CurrencyUtils.calculateBalance(
      oracle.prices[item.balance.denom]?.amount,
      coin,
      currencyInfo.coinDecimals
    );

    if (!balance.toDec().isZero()) {
      labels.push(currencyInfo.shortName);
      colors.push(`${strToColor(currencyInfo.shortName)}`);
      dataValue.push(balance.toDec().toString(4));
      assets.push(new Dec(item.balance.amount, currencyInfo.coinDecimals).toString(4));
    }

    return currencyInfo;
  });
  statChart.value?.updateChart(labels, colors, dataValue, assets);
}

watch(
  () => [oracle.prices, wallet.balances, statChart.value?.chartElement.chart],
  () => {
    if (statChart.value?.chartElement.chart) {
      setChartData();
    }
  },
  {}
);

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);
    for (const lease of leases.value) {
      if (lease.leaseStatus?.opened) {
        const dasset = wallet.getCurrencyByTicker(lease.leaseStatus.opened.amount.ticker);
        const dIbcDenom = wallet.getIbcDenomBySymbol(dasset!.symbol) as string;
        const dDecimal = Number(dasset!.decimal_digits);
        const l = CurrencyUtils.calculateBalance(
          oracle.prices[dIbcDenom].amount,
          new Coin(dIbcDenom, lease.leaseStatus.opened.amount.amount),
          dDecimal
        ).toDec();

        ls = ls.add(l);
      }
      db = db.add(lease.debt as Dec);
      pl = pl.add(lease.pnlAmount as Dec);
    }
    activeLeases.value = ls;
    debt.value = db;
    pnl.value = pl;
  } catch (e) {
    Logger.error(e);
  }
}

async function setRewards() {
  const [r, lpnRewards] = await Promise.all([NetworkUtils.loadDelegator(), getRewards()]);

  const total = r?.total?.[0];
  let value = new Dec("0").add(lpnRewards);

  if (total) {
    value = new Dec(total.amount).add(value);
  }

  value = AssetUtils.getPriceByDenom(value.truncate().toString(), NATIVE_ASSET.denom);
  rewards.value = value;
}

async function getRewards() {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    let rewards = new Dec(0);

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const contract = admin.contracts![protocolKey].lpp;
        const lppClient = new Lpp(cosmWasmClient, contract);
        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

        const lenderRewards = await lppClient.getLenderRewards(walletAddress);
        rewards = rewards.add(new Dec(lenderRewards.rewards.amount));

        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);
        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        const amount = new Dec(depositBalance.balance).mul(calculatedPrice);
        const lpnReward = amount.sub(new Dec(depositBalance.balance)).truncateDec();
        rewards = rewards.add(new Dec(lpnReward.truncate(), LPN_DECIMALS));
      };
      promises.push(fn());
    }

    await Promise.allSettled(promises);

    return rewards;
  } catch (e) {
    return new Dec(0);
  }
}
</script>
<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
