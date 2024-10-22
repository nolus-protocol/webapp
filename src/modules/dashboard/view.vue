<template>
  <div class="mt-[25px]">
    <BannerComponent />
    <div class="col-span-12">
      <!-- Wallet -->
      <div
        class="mt-6 flex flex-col justify-start border-[1px] border-border-color bg-neutral-bg-50 p-4 shadow-field-normal outline md:rounded-xl lg:items-baseline lg:p-6"
      >
        <div class="mb-1.5 flex w-full items-center justify-between md:mb-6">
          <p class="text-16 font-medium text-neutral-typography-200">
            {{ $t("message.portfolio-title") }}
          </p>
          <Button
            :label="$t('message.pnl-history')"
            severity="secondary"
            size="medium"
            class="items-center"
            @click="router.push({ name: RouteNames['PNL-HISTORY'] })"
          />
        </div>
        <div class="mb-4 flex w-full flex-row gap-8 border-b border-border-color pb-4 md:mb-6 md:pb-6">
          <div class="flex flex-col gap-1 md:flex-row md:gap-8">
            <div>
              <p class="text-dark-grey text-12 font-medium">
                {{ $t("message.portfolio-value") }}
              </p>
              <CurrencyComponent
                :amount="totalBalance.toString()"
                :decimals="2"
                :denom="NATIVE_CURRENCY.symbol"
                :fontSize="40"
                :fontSizeSmall="32"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-semibold text-neutral-typography-200"
              />
            </div>

            <div class="md:self-center">
              <p class="text-dark-grey text-12 font-medium">
                {{ $t("message.total-equity") }}
              </p>

              <CurrencyComponent
                :amount="totalEquity.toString()"
                :denom="NATIVE_CURRENCY.symbol"
                :fontSize="20"
                :fontSizeSmall="16"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
              />
            </div>
          </div>
        </div>

        <div class="flex w-full flex-col md:flex-row lg:mt-0">
          <div class="flex">
            <div class="pr-8 lg:pr-0">
              <p class="text-dark-grey text-12 font-medium">
                {{ $t("message.active-leases") }}
              </p>

              <CurrencyComponent
                :amount="activeLeases.toString()"
                :denom="NATIVE_CURRENCY.symbol"
                :fontSize="16"
                :fontSizeSmall="12"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
              />
            </div>

            <div class="lg:pl-8">
              <p class="text-dark-grey text-12 font-medium">
                {{ $t("message.outstanding-loan") }}
              </p>

              <CurrencyComponent
                :amount="debt.toString()"
                :denom="NATIVE_CURRENCY.symbol"
                :fontSize="16"
                :fontSizeSmall="12"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
              />
            </div>
          </div>

          <div
            class="mb-4 border-b border-border-color pb-4 pt-4 md:mb-0 md:border-b-0 md:border-r md:pb-0 md:pl-8 md:pr-8 md:pt-0"
          >
            <p class="text-dark-grey text-12 font-medium">
              {{ $t("message.positions-pnL") }}
            </p>

            <CurrencyComponent
              :amount="pnl.abs().toString()"
              :class="
                pnl.isZero() ? 'text-neutral-typography-200' : pnl.isPositive() ? '!text-[#1AB171]' : 'text-[#E42929]'
              "
              :denom="`${pnl.isZero() ? '' : pnl.isPositive() ? '+' : '-'}${NATIVE_CURRENCY.symbol}`"
              :fontSize="16"
              :fontSizeSmall="12"
              :has-space="false"
              :prettyZeros="true"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              class="font-medium"
            />
          </div>

          <div class="flex">
            <div class="pl-0 pr-8 md:pl-8 md:pr-0">
              <p class="text-dark-grey text-12 font-medium">
                {{ $t("message.supplied-and-staked") }}
              </p>

              <CurrencyComponent
                :amount="earnings.toString()"
                :denom="NATIVE_CURRENCY.symbol"
                :fontSize="16"
                :fontSizeSmall="12"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium text-neutral-typography-200"
              />
            </div>

            <div class="md:pl-8">
              <p class="text-dark-grey text-12 font-medium">
                {{ $t("message.rewards") }}
              </p>
              <CurrencyComponent
                :amount="rewards.abs().toString()"
                :class="
                  rewards.isZero()
                    ? 'text-neutral-typography-200'
                    : rewards.isPositive()
                      ? '!text-[#1AB171]'
                      : 'text-[#E42929]'
                "
                :denom="`${rewards.isZero() ? '' : rewards.isPositive() ? '+' : '-'}${NATIVE_CURRENCY.symbol}`"
                :fontSize="16"
                :fontSizeSmall="12"
                :has-space="false"
                :prettyZeros="true"
                :type="CURRENCY_VIEW_TYPES.CURRENCY"
                class="font-medium"
              />
            </div>
          </div>

          <!-- HIDDEN ON DESKTOP -->
        </div>
      </div>
      <!-- Assets -->
      <Table
        :class="['outline', { 'async-loader': isAssetsLoading }]"
        :columns="assetsColumns"
        :title="$t('message.available-assets')"
        class="mt-6"
      >
        <template #header>
          <div class="flex items-center gap-4">
            <div class="checkbox-container">
              <div class="flex w-full items-center">
                <input
                  id="low-balances"
                  v-model="state.showSmallBalances"
                  name="low-balances"
                  type="checkbox"
                />
                <label
                  class="text-neutral-typography-200"
                  for="low-balances"
                  >{{ $t("message.low-balances") }}</label
                >
              </div>
            </div>
            <Button
              :label="$t('message.receive/send')"
              class="hidden lg:block"
              severity="primary"
              size="large"
              @click="() => sendReceiveOpen()"
            />
            <Button
              class="block lg:hidden"
              icon="icon-transfer"
              iconPosition="left"
              severity="primary"
              size="large"
              @click="() => sendReceiveOpen()"
            />
          </div>
        </template>

        <template
          v-if="loading"
          v-slot:body
        >
          <AssetsSkeleton
            v-for="index in currenciesSize"
            :key="index"
          />
        </template>
        <template
          v-else
          v-slot:body
        >
          <TransitionGroup
            appear
            name="fade"
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
              :openModal="openModal"
              :price="oracle.prices[asset.key]?.amount ?? '0'"
            />
          </TransitionGroup>
        </template>
      </Table>
      <!-- Vested Assets -->
      <Table
        v-if="vestedTokens.length > 0"
        :columns="vestedColumns"
        :title="$t('message.vested')"
        class="mt-6"
      >
        <template v-slot:body>
          <VestedAssetPartial
            v-for="(asset, index) in vestedTokens"
            :key="`${asset.amount.amount}-${index}`"
            :asset-balance="wallet.vestTokens.amount.toString()"
            :asset-info="getAssetInfo(asset.amount.denom)"
            :denom="asset.amount.denom"
            :end-time="asset.endTime"
          />
        </template>
      </Table>
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
import { AssetPartial, AssetsSkeleton, BannerComponent, VestedAssetPartial } from "./components";
import { DASHBOARD_ACTIONS } from "./types";
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import SupplyWithdrawDialog from "@/common/components/modals/SupplyWithdrawDialog.vue";
import LeaseDialog from "@/common/components/modals/LongShortDialog.vue";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import SendReceiveDialogV2 from "@/common/components/modals/SendReceiveDialogV2.vue";

import { CURRENCY_VIEW_TYPES, type ExternalCurrency } from "@/common/types";

import { useI18n } from "vue-i18n";
import { computed, onUnmounted, provide, ref, watch } from "vue";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { useLeases } from "@/common/composables/useLeases";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { useAdminStore } from "@/common/stores/admin";

import { AssetUtils, Logger, NetworkUtils, WalletManager } from "@/common/utils";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { NATIVE_ASSET, NATIVE_CURRENCY, ProtocolsConfig } from "@/config/global";
import { CurrencyDemapping } from "@/config/currencies";
import { Button, Table } from "web-components";
import { RouteNames, router } from "@/router";

const modalOptions = {
  // [DASHBOARD_ACTIONS.SEND]: SendReceiveDialog,
  // [DASHBOARD_ACTIONS.RECEIVE]: SendReceiveDialog,
  [DASHBOARD_ACTIONS.SEND]: SendReceiveDialogV2,
  [DASHBOARD_ACTIONS.RECEIVE]: SendReceiveDialogV2,
  [DASHBOARD_ACTIONS.SUPPLY]: SupplyWithdrawDialog,
  [DASHBOARD_ACTIONS.LEASE]: LeaseDialog
};

const smallBalancesStateKey = "smallBalancesState";

const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const admin = useAdminStore();

const i18n = useI18n();
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
const assetsColumns = [
  { label: i18n.t("message.assets") },
  { label: i18n.t("message.balance") },
  { label: i18n.t("message.yield"), tooltip: i18n.t("message.earn-apr-tooltip"), class: "hidden md:flex" },
  {
    label: i18n.t("message.lease-up-to"),
    tooltip: i18n.t("message.lease-up-to-tooltip"),
    class: "hidden md:flex justify-end"
  }
];
const vestedColumns = [
  { label: i18n.t("message.assets") },
  { label: i18n.t("message.release"), class: "hidden md:flex !justify-start" },
  { label: i18n.t("message.balance") }
];

let timeout: NodeJS.Timeout;

const state = ref({
  showSmallBalances: !localStorage.getItem(smallBalancesStateKey),
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
  const balances = state.value.showSmallBalances ? wallet.currencies : filterSmallBalances(wallet.currencies);
  return balances.sort((a, b) => {
    const aAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[a.key]?.amount,
      new Coin(a.balance.denom, a.balance.amount.toString()),
      a.decimal_digits as number
    ).toDec();

    const bAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[b.key]?.amount,
      new Coin(b.balance.denom, b.balance.amount.toString()),
      b.decimal_digits as number
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
  wallet.currencies.forEach((asset) => {
    const currency = AssetUtils.getCurrencyByDenom(asset.balance.denom);
    const assetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[asset.key]?.amount ?? 0,
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
        const lpn_ticker = await lppClient.getLPN();
        const lpnCoin = app.currenciesData![`${CurrencyDemapping[lpn_ticker]?.ticker ?? lpn_ticker}@${protocolKey}`];
        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();
        const lpnPrice = new Dec(oracle.prices[lpnCoin.key].amount);
        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);

        const calculatedPrice = new Dec(price.amount_quote.amount).mul(lpnPrice).quo(new Dec(price.amount.amount));
        const a = new Dec(depositBalance.balance, Number(lpnCoin!.decimal_digits)).mul(calculatedPrice);

        amount = amount.add(a);
      };

      promises.push(fn());
    }

    await Promise.all(promises);

    return amount;
  };

  const delegated = async () => {
    const delegations = await NetworkUtils.loadDelegations();
    let v = new Dec(0);

    for (const item of delegations) {
      const p = AssetUtils.getPriceByDenom(item.balance.amount, NATIVE_ASSET.denom);
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
    .catch((e) => console.log(e));
}

function filterSmallBalances(balances: ExternalCurrency[]) {
  return balances.filter((asset) => asset.balance.amount.gt(new Int("1")));
}

function openModal(action: DASHBOARD_ACTIONS, denom = "") {
  state.value.dialogSelectedCurrency = "";
  state.value.selectedAsset = denom;
  state.value.modalAction = action;
  state.value.showModal = true;
}

function getAssetInfo(denom: string) {
  return AssetUtils.getCurrencyByDenom(denom);
}

watch(
  () => state.value.showSmallBalances,
  () => {
    setSmallBalancesState(state.value.showSmallBalances);
  }
);

function setSmallBalancesState(event: boolean) {
  if (!event) {
    localStorage.setItem(smallBalancesStateKey, "false");
  } else {
    localStorage.removeItem(smallBalancesStateKey);
  }
}

function sendReceiveOpen(currency: string = "") {
  state.value.selectedAsset = "";
  state.value.dialogSelectedCurrency = currency;
  state.value.modalAction = DASHBOARD_ACTIONS.RECEIVE;
  state.value.showModal = true;
}

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);
    for (const lease of leases.value) {
      if (lease.leaseStatus?.opened) {
        const dasset = AssetUtils.getCurrencyByTicker(lease.leaseStatus.opened.amount.ticker!);
        const lpn = AssetUtils.getLpnByProtocol(lease.protocol);
        const price = oracle.prices[lpn.key];

        const dDecimal = Number(dasset!.decimal_digits);
        const l = CurrencyUtils.calculateBalance(
          oracle.prices[dasset.key]?.amount,
          new Coin(dasset.ibcData, lease.leaseStatus.opened.amount.amount),
          dDecimal
        ).toDec();

        ls = ls.add(l);
        lease.debt = lease.debt.mul(new Dec(price.amount));
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
      if (ProtocolsConfig[protocolKey].rewards) {
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
          const lpn = AssetUtils.getLpnByProtocol(protocolKey);

          rewards = rewards.add(new Dec(lpnReward.truncate(), lpn.decimal_digits));
        };
        promises.push(fn());
      }
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
