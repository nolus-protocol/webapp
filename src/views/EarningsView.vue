<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:pt-[25px] lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          {{ $t("message.earn-title") }}
        </h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Portfolio -->
        <div
             class="block order-2 order-1 background md:col-span-7 md:mt-6 async-loader outline border-standart shadow-box md:rounded-xl p-5">
          <div class="lg:flex block items-center justify-between">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              {{ $t("message.earning-assets") }}
            </h2>
          </div>
          <!-- Assets -->
          <div class="block mt-6 md:mt-[25px]">
            <!-- Assets Header -->

            <div class="grid grid-cols-2 md:grid-cols-3 gap-6 border-b border-standart pb-3">
              <div class="nls-font-500 text-12 text-dark-grey text-left text-upper">
                {{ $t("message.asset") }}
              </div>

              <div
                   class="inline-flex items-center nls-font-500 text-12 text-dark-grey text-center hidden md:flex text-upper md:col-span-1 justify-end md:m-r[10px]">
                <span class="inline-block">{{ $t("message.deposit") }}</span>
                <TooltipComponent :content="$t('message.deposit-tooltip')" />
              </div>

              <div
                   class="flex nls-font-500 text-12 text-dark-grey text-right text-upper md:flex items-center justify-end items-center">
                {{ $t("message.yield") }}
                <TooltipComponent :content="$t('message.earn-view-apr-tooltip')" />
              </div>
            </div>

            <div role="status"
                 class="block lg:mb-0"
                 :class="{ 'animate-pulse': loading }">
              <template v-if="loading">
                <div v-for="index in 2"
                     :key="index"
                     class="h-[67px] flex items-center justify-between asset-partial nolus-box relative border-b border-standart py-3 px-4 items-center justify-between">
                  <div class="w-[50%] md:w-auto grow-[1]">
                    <div class="w-32 h-1.5 bg-grey rounded-full mb-2.5"></div>
                    <div class="h-1.5 bg-grey rounded-full w-24"></div>
                  </div>
                  <div class="flex flex-col w-[50%] md:w-auto grow-[4] md:items-start items-end">
                    <div class="w-32 h-1.5 bg-grey rounded-full mb-2.5"></div>
                    <div class="h-1.5 bg-grey rounded-full w-24 ml-8"></div>
                  </div>
                  <div class="h-1.5 bg-grey rounded-full w-12 hidden md:flex"></div>
                </div>
              </template>
              <template v-else>
                <TransitionGroup name="fade"
                                 appear
                                 tag="div">

                  <EarnLpnAsset v-for="(lpn, index) of lpnAsset"
                                :key="lpn.balance.denom"
                                :asset="lpn"
                                :openSupplyWithdraw="() => openSupplyWithdrawDialog(lpn.balance.denom)"
                                :cols="cols"
                                :class="index > 0 ? 'border-t-[1px]' : ''" />

                  <EarnNativeAsset key="nativeAsset"
                                   :asset="delegated"
                                   :cols="cols"
                                   :openDelegateUndelegate="() => openDelegateUndelegateDialog()"
                                   :isDelegated="isDelegated" />
                </TransitionGroup>
              </template>
            </div>

          </div>
        </div>
        <!-- Portfolio -->
      </div>

      <div class="md:col-span-5 lg:co-span-5">
        <!-- Rewards -->
        <div
             class="block order-2 md:order-1 background md:col-span-7 mt-6 outline border-standart shadow-box md:rounded-xl p-5">
          <div class="flex items-center justify-between border-b border-standart pb-6">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              {{ $t("message.rewards") }}
            </h2>
          </div>
          <!-- Assets -->
          <div class="block">
            <!-- Assets Container -->
            <EarnReward :reward="reward"
                        :onClickClaim="onClickWithdrawRewards"
                        :cols="cols" />
            <!-- Assets Container -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal v-if="showSupplyWithdrawDialog"
         route="supply"
         @close-modal="showSupplyWithdrawDialog = false">
    <SupplyWithdrawDialog :selectedAsset="selectedAsset" />
  </Modal>

  <Modal v-if="showDelegateUndelegateDialog"
         route="delegate"
         @close-modal="showDelegateUndelegateDialog = false">
    <DelegateUndelegateDialog :selectedAsset="selectedAsset" />
  </Modal>

  <Modal v-if="showWithrawRewardsDialog"
         route="withdraw-rewards"
         @close-modal="showWithrawRewardsDialog = false">
    <WithdrawRewardsDialog :amount="reward" />
  </Modal>

  <Modal v-if="showErrorDialog"
         route="alert"
         @close-modal="showErrorDialog = false">
    <ErrorDialog :title="$t('message.error-connecting')"
                 :message="errorMessage"
                 :try-button="onClickTryAgain" />
  </Modal>
</template>

<script setup lang="ts">
import type { AssetBalance } from "@/stores/wallet/state";

import EarnNativeAsset from "@/components/EarningsComponents/EarnNativeAsset.vue";
import EarnReward from "@/components/EarningsComponents/EarnReward.vue";
import SupplyWithdrawDialog from "@/components/modals/SupplyWithdrawDialog.vue";
import DelegateUndelegateDialog from "@/components/modals/DelegateUndelegateDialog.vue";
import WithdrawRewardsDialog from "@/components/modals/WithdrawRewardsDialog.vue";
import EarnLpnAsset from "@/components/EarningsComponents/EarnLpnAsset.vue";

import Modal from "@/components/modals/templates/Modal.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";

import { onMounted, onUnmounted, provide, ref, watch } from "vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { WalletManager } from "@/utils";
import { Dec } from "@keplr-wallet/unit";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";

import { claimRewardsMsg, type ContractData, Lpp } from "@nolus/nolusjs/build/contracts";
import { NATIVE_ASSET, UPDATE_REWARDS_INTERVAL } from "@/config/env";
import { coin } from "@cosmjs/amino";
import { useApplicationStore } from "@/stores/application";
import { storeToRefs } from "pinia";
import { useAdminStore } from "@/stores/admin";

const wallet = useWalletStore();

let rewardsInterval: NodeJS.Timeout | undefined;
const cols = ref(3 as number);
const showSupplyWithdrawDialog = ref(false);
const showDelegateUndelegateDialog = ref(false);
const showWithrawRewardsDialog = ref(false);

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
const lpnAsset = ref<AssetBalance[] | []>([])
const lpnReward = ref(new Dec(0))
const applicaton = useApplicationStore();
const applicationRef = storeToRefs(applicaton);
const admin = useAdminStore();

onMounted(async () => {

  try {
    const [_delegations] = await Promise.allSettled([
      wallet[WalletActionTypes.LOAD_DELEGATIONS](),
      loadRewards(),
      loadLPNCurrency(),
      loadDelegated(),
      wallet[WalletActionTypes.LOAD_STAKED_TOKENS]()
    ]);

    rewardsInterval = setInterval(async () => {
      const [_delegations] = await Promise.allSettled([
        wallet[WalletActionTypes.LOAD_DELEGATIONS](),
        loadRewards(),
        loadLPNCurrency(),
        loadDelegated()
      ]);
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
    const [_delegations] = await Promise.allSettled([
      wallet[WalletActionTypes.LOAD_DELEGATIONS](),
      loadRewards(),
      loadLPNCurrency(),
      loadDelegated()
    ]);
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
  await Promise.all([
    loadRewards(),
    loadLPNCurrency()
  ]);
};

function onClickWithdrawRewards() {
  showWithrawRewardsDialog.value = true;
};

function openSupplyWithdrawDialog(denom: string) {
  selectedAsset.value = denom;
  showSupplyWithdrawDialog.value = true;
};

async function loadRewards() {

  const [rewards, lpnRewards] = await Promise.all([
    wallet[WalletActionTypes.LOAD_DELEGATOR](),
    getRewards()
  ]);

  const total = rewards?.total?.[0];
  let value = new Dec('0').add(lpnRewards);

  if (total) {
    value = new Dec(total.amount).add(value)
  }

  reward.value = { balance: coin(value.truncate().toString(), NATIVE_ASSET.denom) };
}

async function getRewards() {
  try {

    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const promises = [];
    const rewards = new Dec(0);

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const contract = admin.contracts[protocolKey].lpp;
        const lppClient = new Lpp(cosmWasmClient, contract);
        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();

        const lenderRewards = await lppClient.getLenderRewards(walletAddress);
        rewards.add(new Dec(lenderRewards.rewards.amount));
      }
      promises.push(fn());
    }

    await Promise.all(promises);
    lpnReward.value = rewards;

    return rewards;

  } catch (e) {
    console.log(e)
  }

  return new Dec(0);
}

async function loadDelegated() {

  const delegations = await wallet[WalletActionTypes.LOAD_DELEGATIONS]();
  let decimalDelegated = new Dec(0);

  for (const item of delegations) {
    const d = new Dec(item.balance.amount);
    decimalDelegated = decimalDelegated.add(d);
  }

  if (decimalDelegated.isPositive()) {
    isDelegated.value = true;
  }

  delegated.value = { balance: coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom) };
}

async function loadLPNCurrency() {

  const lpnCurrencies: AssetBalance[] = [];
  const lpns = applicaton.lpn;
  const promises = [];
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

  for (const lpn of lpns ?? []) {
    const index = wallet.balances.findIndex((item) => item.balance.denom == lpn.ibcData);
    if (index > -1) {
      const fn = async () => {

        const c = wallet.currencies[lpn.ibcData!];
        const [_currency, protocol] = c.ticker.split('@');

        const contract = admin.contracts[protocol].lpp;
        const lppClient = new Lpp(cosmWasmClient, contract);

        claimContractData.value.push({
          contractAddress: contract,
          msg: claimRewardsMsg(),
        });

        const walletAddress = wallet.wallet?.address ?? WalletManager.getWalletAddress();
        const [depositBalance, price] = await Promise.all([
          lppClient.getLenderDeposit(
            walletAddress as string
          ),
          lppClient.getPrice()
        ]);
        const calculatedPrice = new Dec(price.amount_quote.amount).quo(
          new Dec(price.amount.amount)
        );
        const amount = new Dec(depositBalance.balance).mul(calculatedPrice).truncate();
        const currency = {
          balance: {
            ...wallet.balances[index].balance
          },
        };
        currency.balance.amount = amount;
        lpnCurrencies.push(currency)

      }
      promises.push(fn());

    }
  }

  await Promise.all(promises);
  lpnAsset.value = lpnCurrencies;

}

function openDelegateUndelegateDialog() {
  selectedAsset.value = NATIVE_ASSET.denom;
  showDelegateUndelegateDialog.value = true;
}

provide("loadRewards", loadRewards);
provide("loadLPNCurrency", loadLPNCurrency);
provide("loadDelegated", loadDelegated);

</script>
