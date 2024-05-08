<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:px-0 lg:pt-[25px]">
      <div class="left w-full md:w-1/2">
        <h1 class="nls-font-700 nls-sm-title m-0 text-20 text-primary">
          {{ $t("message.earn-title") }}
        </h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Portfolio -->
        <div
          class="background async-loader border-standart shadow-box order-1 order-2 block p-5 outline md:col-span-7 md:mt-6 md:rounded-xl"
        >
          <div class="block items-center justify-between lg:flex">
            <h2 class="nls-font-500 my-0 text-left text-16 text-primary">
              {{ $t("message.earning-assets") }}
            </h2>
          </div>
          <!-- Assets -->
          <div class="mt-6 block md:mt-[25px]">
            <!-- Assets Header -->

            <div class="border-standart grid grid-cols-2 gap-6 border-b pb-3 md:grid-cols-3">
              <div class="nls-font-500 text-dark-grey text-upper text-left text-12">
                {{ $t("message.asset") }}
              </div>

              <div
                class="nls-font-500 text-dark-grey text-upper md:m-r[10px] inline-flex hidden items-center justify-end text-center text-12 md:col-span-1 md:flex"
              >
                <span class="inline-block">{{ $t("message.deposit") }}</span>
                <TooltipComponent :content="$t('message.deposit-tooltip')" />
              </div>

              <div
                class="nls-font-500 text-dark-grey text-upper flex items-center items-center justify-end text-right text-12 md:flex"
              >
                {{ $t("message.yield") }}
                <TooltipComponent :content="$t('message.earn-view-apr-tooltip')" />
              </div>
            </div>

            <div
              :class="{ 'animate-pulse': loading }"
              class="block lg:mb-0"
              role="status"
            >
              <template v-if="loading">
                <div
                  v-for="index in 2"
                  :key="index"
                  class="asset-partial nolus-box border-standart relative flex h-[67px] items-center items-center justify-between justify-between border-b px-4 py-3"
                >
                  <div class="w-[50%] grow-[1] md:w-auto">
                    <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
                    <div class="h-1.5 w-24 rounded-full bg-grey"></div>
                  </div>
                  <div class="flex w-[50%] grow-[4] flex-col items-end md:w-auto md:items-start">
                    <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
                    <div class="ml-8 h-1.5 w-24 rounded-full bg-grey"></div>
                  </div>
                  <div class="hidden h-1.5 w-12 rounded-full bg-grey md:flex"></div>
                </div>
              </template>
              <template v-else>
                <TransitionGroup
                  appear
                  name="fade"
                  tag="div"
                >
                  <EarnLpnAsset
                    v-for="(lpn, index) of lpnAsset"
                    :key="lpn.key"
                    :asset="lpn"
                    :class="index > 0 ? 'border-t-[1px]' : ''"
                    :cols="cols"
                    :openSupplyWithdraw="() => openSupplyWithdrawDialog(lpn.key)"
                  />

                  <EarnNativeAsset
                    key="nativeAsset"
                    :asset="delegated"
                    :cols="cols"
                    :isDelegated="isDelegated"
                    :openDelegateUndelegate="() => openDelegateUnDelegateDialog()"
                  />
                </TransitionGroup>
              </template>
            </div>
          </div>
        </div>
        <!-- Portfolio -->

        <Table
          :class="['outline', { 'animate-pulse': loading }]"
          :columns="earningColumns"
          :title="$t('message.earning-assets')"
        >
          <template
            v-if="loading"
            v-slot:body
          >
            <div
              v-for="index in 2"
              :key="index"
              class="asset-partial nolus-box border-standart relative flex h-[67px] items-center items-center justify-between justify-between border-b px-4 py-3"
            >
              <div class="w-[50%] grow-[1] md:w-auto">
                <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
                <div class="h-1.5 w-24 rounded-full bg-grey"></div>
              </div>
              <div class="flex w-[50%] grow-[4] flex-col items-end md:w-auto md:items-start">
                <div class="mb-2.5 h-1.5 w-32 rounded-full bg-grey"></div>
                <div class="ml-8 h-1.5 w-24 rounded-full bg-grey"></div>
              </div>
              <div class="hidden h-1.5 w-12 rounded-full bg-grey md:flex"></div>
            </div>
          </template>
          <template
            v-else
            v-slot:body
          >
            <TransitionGroup
              appear
              name="fade"
              tag="div"
            >
              <EarnAssetRowWrapper
                v-for="(asset, index) of assets"
                :key="index"
                :asset="asset"
              />
            </TransitionGroup>
          </template>
        </Table>
      </div>

      <div class="lg:co-span-5 md:col-span-5">
        <!-- Rewards -->
        <div
          class="background border-standart shadow-box order-2 mt-6 block p-5 outline md:order-1 md:col-span-7 md:rounded-xl"
        >
          <div class="border-standart flex items-center justify-between border-b pb-6">
            <h2 class="nls-font-500 my-0 text-left text-16 text-primary">
              {{ $t("message.rewards") }}
            </h2>
          </div>
          <!-- Assets -->
          <div class="block">
            <!-- Assets Container -->
            <EarnReward
              :cols="cols"
              :onClickClaim="onClickWithdrawRewards"
              :reward="reward"
            />
            <!-- Assets Container -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal
    v-if="showSupplyWithdrawDialog"
    route="supply"
    @close-modal="showSupplyWithdrawDialog = false"
  >
    <SupplyWithdrawDialog :selectedAsset="selectedAsset" />
  </Modal>

  <Modal
    v-if="showDelegateUndelegateDialog"
    route="delegate"
    @close-modal="showDelegateUndelegateDialog = false"
  >
    <DelegateUndelegateDialog />
  </Modal>

  <Modal
    v-if="showWithrawRewardsDialog"
    route="withdraw-rewards"
    @close-modal="showWithrawRewardsDialog = false"
  >
    <WithdrawRewardsDialog :amount="reward" />
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
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Asset } from "./types";

import SupplyWithdrawDialog from "@/common/components/modals/SupplyWithdrawDialog.vue";
import DelegateUndelegateDialog from "@/common/components/modals/DelegateUndelegateDialog.vue";
import WithdrawRewardsDialog from "@/common/components/modals/WithdrawRewardsDialog.vue";

import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";
import TooltipComponent from "@/common/components/TooltipComponent.vue";

import { EarnLpnAsset, EarnNativeAsset, EarnReward } from "./components";
import { onMounted, onUnmounted, provide, ref, watch } from "vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { AppUtils, Logger, NetworkUtils, WalletManager } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";

import { claimRewardsMsg, type ContractData, Lpp } from "@nolus/nolusjs/build/contracts";
import { NATIVE_ASSET, UPDATE_REWARDS_INTERVAL } from "@/config/global";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/common/stores/application";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useAdminStore } from "@/common/stores/admin";
import { Table } from "web-components";
import EarnAssetRowWrapper from "@/modules/earn/components/EarnAssetRowWrapper.vue";

const i18n = useI18n();

const wallet = useWalletStore();

let rewardsInterval: NodeJS.Timeout | undefined;
const cols = ref(3 as number);
const showSupplyWithdrawDialog = ref(false);
const showDelegateUndelegateDialog = ref(false);
const showWithrawRewardsDialog = ref(false);
const sort = ["OSMOSIS-OSMOSIS-USDC_NOBLE", "OSMOSIS-OSMOSIS-USDC_AXELAR", "NEUTRON-ASTROPORT-USDC_AXELAR"];

const reward = ref({
  balance: coin(0, ChainConstants.COIN_MINIMAL_DENOM)
} as AssetBalance);

const delegated = ref({
  balance: coin(0, ChainConstants.COIN_MINIMAL_DENOM)
} as AssetBalance);

const claimContractData = ref([] as ContractData[]);
const selectedAsset = ref("");
const showErrorDialog = ref(false);
const errorMessage = ref("");
const loading = ref(true);
const isDelegated = ref(false);
const lpnAsset = ref<Asset[] | []>([]);
const lpnReward = ref(new Dec(0));
const application = useApplicationStore();
const applicationRef = storeToRefs(application);
const admin = useAdminStore();
const earningColumns = [
  { label: i18n.t("message.asset") },
  { label: i18n.t("message.deposit"), tooltip: i18n.t("message.deposit-tooltip"), class: "hidden md:flex" },
  { label: i18n.t("message.yield"), tooltip: i18n.t("message.earn-view-apr-tooltip") }
];

onMounted(async () => {
  try {
    await Promise.allSettled([
      NetworkUtils.loadDelegations(),
      loadRewards(),
      loadLPNCurrency(),
      loadDelegated(),
      wallet[WalletActions.LOAD_STAKED_TOKENS]()
    ]);

    rewardsInterval = setInterval(async () => {
      await Promise.allSettled([NetworkUtils.loadDelegations(), loadRewards(), loadLPNCurrency(), loadDelegated()]);
    }, UPDATE_REWARDS_INTERVAL);

    loading.value = false;
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
});

onUnmounted(() => {
  clearInterval(rewardsInterval);
});

watch(
  () => wallet.balances,
  async (value) => {
    await Promise.allSettled([NetworkUtils.loadDelegations(), loadRewards(), loadLPNCurrency(), loadDelegated()]);
  }
);

watch(
  () => applicationRef.sessionExpired.value,
  (value) => {
    if (value) {
      clearInterval(rewardsInterval);
    }
  }
);

async function onClickTryAgain() {
  await Promise.all([loadRewards(), loadLPNCurrency()]);
}

function onClickWithdrawRewards() {
  showWithrawRewardsDialog.value = true;
}

function openSupplyWithdrawDialog(denom: string) {
  selectedAsset.value = denom;
  showSupplyWithdrawDialog.value = true;
}

async function loadRewards() {
  const [rewards, lpnRewards] = await Promise.all([NetworkUtils.loadDelegator(), getRewards()]);

  const total = rewards?.total?.[0];
  let value = new Dec("0").add(lpnRewards);

  if (total) {
    value = new Dec(total.amount).add(value);
  }

  reward.value = { balance: coin(value.truncate().toString(), NATIVE_ASSET.denom) };
}

async function getRewards() {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    let rewards = new Dec(0);

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        try {
          const contract = admin.contracts![protocolKey].lpp;
          const lppClient = new Lpp(cosmWasmClient, contract);
          const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

          const lenderRewards = await lppClient.getLenderRewards(walletAddress);
          rewards = rewards.add(new Dec(lenderRewards.rewards.amount));
        } catch (e) {
          Logger.error(e);
        }
      };
      promises.push(fn());
    }

    await Promise.allSettled(promises);
    lpnReward.value = rewards;

    return rewards;
  } catch (e) {
    Logger.error(e);
  }

  return new Dec(0);
}

async function loadDelegated() {
  const delegations = await NetworkUtils.loadDelegations();
  let decimalDelegated = new Dec(0);

  for (const item of delegations) {
    const d = new Dec(item.balance.amount);
    decimalDelegated = decimalDelegated.add(d);
  }

  if (decimalDelegated.isPositive()) {
    isDelegated.value = true;
  }

  console.info({ delegations, decimalDelegated });

  delegated.value = { balance: coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom) };
  console.info({ delegated: delegated.value });
}

async function loadLPNCurrency() {
  const lpnCurrencies: Asset[] = [];
  const lpns = application.lpn;
  const promises = [];
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

  for (const lpn of lpns ?? []) {
    const index = wallet.balances.findIndex((item) => item.balance.denom == lpn.ibcData);
    if (index > -1) {
      const fn = async () => {
        const c = application.currenciesData![lpn.key!];
        const [_currency, protocol] = c.key!.split("@");
        const contract = admin.contracts![protocol].lpp;
        const lppClient = new Lpp(cosmWasmClient, contract);

        claimContractData.value.push({
          contractAddress: contract,
          msg: claimRewardsMsg()
        });

        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(walletAddress as string),
          lppClient.getPrice()
        ]);

        const calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
        const amount = new Dec(depositBalance.balance).mul(calculatedPrice).roundUp().toString();
        const currency = {
          key: c.key,
          balance: {
            ...wallet.balances[index].balance
          }
        };
        currency.balance.amount = amount;
        lpnCurrencies.push(currency);
      };
      promises.push(fn());
    }
  }

  await Promise.allSettled(promises);
  const items = [];

  for (const protocol of sort) {
    const index = lpnCurrencies.findIndex((item) => {
      const [_key, pr] = item.key.split("@");
      return pr == protocol;
    });
    if (index > -1) {
      items.push(lpnCurrencies[index]);
      lpnCurrencies.splice(index, 1);
    }
  }

  lpnAsset.value = [...items, ...lpnCurrencies];

  console.info({ lpnAsset: lpnAsset.value });
}

function openDelegateUnDelegateDialog() {
  selectedAsset.value = `${NATIVE_ASSET.ticker}@${AppUtils.getDefaultProtocol()}`;
  showDelegateUndelegateDialog.value = true;
}

provide("loadRewards", loadRewards);
provide("loadLPNCurrency", loadLPNCurrency);
provide("loadDelegated", loadDelegated);
</script>
