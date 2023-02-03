<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div
      class="flex flex-wrap items-center justify-between px-4 lg:pt-[25px] lg:px-0"
    >
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
          class="nolus-box block order-2 order-1 background border-y border-standart radius-medium md:col-span-7 md:mt-6 async-loader outline"
        >
          <div class="lg:flex block items-center justify-between px-6 pt-6">
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              {{ $t("message.earning-assets") }}
            </h2>
            <!-- <div class="right w-full md:w-1/2 md:mt-0 inline-flex justify-start md:justify-end">
              <div class="relative block checkbox-container">
                <div class="flex items-center w-full justify-end">
                  <input
                    id="show-small-balances"
                    v-model="showSmallBalances"
                    aria-describedby="show-small-balances"
                    name="show-small-balances"
                    type="checkbox"
                  />
                  <label for="show-small-balances">{{ $t('message.show-small-balances') }}</label>
                </div>
              </div>
            </div> -->
          </div>
          <!-- Assets -->
          <div class="block mt-6 md:mt-[25px]">
            <!-- Assets Header -->
            <div
              class="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6"
            >
              <div
                class="nls-font-500 text-12 text-dark-grey text-left text-upper"
              >
                {{ $t("message.asset") }}
              </div>

              <div
                class="inline-flex items-center nls-font-500 text-12 text-dark-grey text-center text-upper pl-[15px] md:col-span-2 ml-4 justify-end md:justify-start"
              >
                <span class="inline-block">{{ $t("message.deposit") }}</span>
                <TooltipComponent :content="$t('message.deposit-tooltip')" />
              </div>

              <div
                class="nls-font-500 text-12 text-dark-grey text-right text-upper md:flex hidden items-center justify-end"
              >
                {{ $t("message.apr") }}
                <TooltipComponent
                  :content="$t('message.earn-view-apr-tooltip')"
                />
              </div>
            </div>

            <!-- Assets Container -->
            <EarnAsset
              v-for="(asset, index) in filteredAssets"
              :key="`${asset.balance.denom}-${index}`"
              :asset="asset"
              :openSupplyWithdraw="() => openSupplyWithdrawDialog(asset.balance.denom)"
              :cols="cols"
            />

            <EarnNativeAsset
              v-if="nativeAsset"
              :asset="nativeAsset"
              :cols="cols"
              :openDelegateUndelegate="() => openDelegateUndelegateDialog()"
            />
          </div>
        </div>
        <!-- Portfolio -->
      </div>

      <div class="md:col-span-5 lg:co-span-5">
        <!-- Rewards -->
        <div
          class="nolus-box block order-2 md:order-1 background border-y border-standart radius-medium md:col-span-7 mt-6 outline"
        >
          <div
            class="flex items-center justify-between px-6 pt-6 border-b border-standart pb-4"
          >
            <h2 class="text-16 nls-font-500 text-left my-0 text-primary">
              {{ $t("message.rewards") }}
            </h2>
            <!-- <button class="btn-label btn-large-label">{{ $t('message.claim-all') }}</button> -->
          </div>
          <!-- Assets -->
          <div class="block mt-4">
            <!-- Assets Container -->
            <EarnReward
              :reward="reward"
              :onClickClaim="onClickWithdrawRewards"
              :cols="cols"
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
    <DelegateUndelegateDialog :selectedAsset="selectedAsset" />
  </Modal>

  <Modal
    v-if="showClaimModal"
    route="claim"
    @close-modal="showClaimModal = false"
  >
    <ClaimDialog
      :contract-data="claimContractData"
      :reward="totalNlsRewards()"
    />
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
      :title="$t('message.error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import EarnAsset from "@/components/EarningsComponents/EarnAsset.vue";
import EarnNativeAsset from "@/components/EarningsComponents/EarnNativeAsset.vue";

import EarnReward from "@/components/EarningsComponents/EarnReward.vue";
import SupplyWithdrawDialog from "@/components/modals/SupplyWithdrawDialog.vue";
import DelegateUndelegateDialog from "@/components/modals/DelegateUndelegateDialog.vue";
import WithdrawRewardsDialog from "@/components/modals/WithdrawRewardsDialog.vue";

import Modal from "@/components/modals/templates/Modal.vue";
import ClaimDialog from "@/components/modals/ClaimDialog.vue";
import ErrorDialog from "@/components/modals/ErrorDialog.vue";
import TooltipComponent from "@/components/TooltipComponent.vue";
import CURRENCIES from "@/config/currencies.json";

import type { AssetBalance } from "@/stores/wallet/state";

import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { CONTRACTS } from "@/config/contracts";
import { EnvNetworkUtils } from "@/utils/EnvNetworkUtils";
import { WalletManager } from "@/utils";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";

import {
  claimRewardsMsg,
  type ContractData,
  Lpp,
} from "@nolus/nolusjs/build/contracts";
import { NATIVE_ASSET, UPDATE_REWARDS_INTERVAL } from "@/config/env";
import { coin } from "@cosmjs/amino";

const wallet = useWalletStore();

let rewardsInterval: NodeJS.Timeout | undefined;
const cols = ref(4 as number);
const showSupplyWithdrawDialog = ref(false);
const showDelegateUndelegateDialog = ref(false);
const showWithrawRewardsDialog = ref(false);

const availableCurrencies = ref([] as string[]);
const rewards = ref([] as AssetBalance[]);
const reward = ref({
  balance: coin(0, ChainConstants.COIN_MINIMAL_DENOM)
} as AssetBalance);
const claimContractData = ref([] as ContractData[]);
const selectedAsset = ref("");
const showSmallBalances = ref(true);
const showClaimModal = ref(false);
const showErrorDialog = ref(false);
const errorMessage = ref("");

onMounted(async () => {
  try {
    await Promise.all([
      wallet[WalletActionTypes.UPDATE_BALANCES](),
      loadRewards(),
      loadLPNCurrency()
    ]);
    rewardsInterval = setInterval(async () => {
      await loadRewards();
    }, UPDATE_REWARDS_INTERVAL);
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
});

onUnmounted(() => {
  clearInterval(rewardsInterval);
});

const filteredAssets = computed(() => {
  const balances = wallet.balances.filter((asset) => {
    return availableCurrencies.value.includes(asset.balance.denom);
  });
  return showSmallBalances.value
    ? balances
    : filterSmallBalances(balances as AssetBalance[]);
});

const nativeAsset = computed(() => {
  const nativeDenom = wallet.getIbcDenomBySymbol(
    CURRENCIES.currencies.NLS.symbol
  );
  const index = wallet.balances.findIndex((item) => {
    return item.balance.denom == nativeDenom;
  });
  return wallet.balances[index];
});

const filterSmallBalances = (balances: AssetBalance[]) => {
  return balances.filter((asset) => asset.balance.amount.gt(new Int("1")));
};

const onClickTryAgain = async () => {
  await Promise.all([
    loadRewards(),
    loadLPNCurrency()
  ]);
};

const onClickClaim = () => {
  showClaimModal.value = true;
};

const onClickWithdrawRewards = () => {
  showWithrawRewardsDialog.value = true;
};

const totalNlsRewards = (): AssetBalance => {
  let totalBalance = new Dec(0);
  rewards.value.forEach((reward) => {
    totalBalance = totalBalance.add(reward.balance.amount.toDec());
  });
  return {
    balance: new Coin(
      ChainConstants.COIN_MINIMAL_DENOM,
      totalBalance.truncate()
    ),
  };
};

const openSupplyWithdrawDialog = (denom: string) => {
  selectedAsset.value = denom;
  showSupplyWithdrawDialog.value = true;
};

const loadRewards = async () => {
  const rewards = await wallet[WalletActionTypes.LOAD_DELEGATOR]();
  const total = rewards?.total?.[0];

  if(total){
    const value = new Dec(total.amount).truncate().toString();
    reward.value = { balance: coin(value, NATIVE_ASSET.denom) };
  }

}

const loadLPNCurrency = async () => {
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const contract = CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance;
  const lppClient = new Lpp(cosmWasmClient, contract);

  claimContractData.value.push({
    contractAddress: contract,
    msg: claimRewardsMsg(),
  });

  const lppConfig = await lppClient.getLppConfig();
  const lpnCoin = wallet.getCurrencyByTicker(lppConfig.lpn_ticker);
  const lpnIbcDenom = wallet.getIbcDenomBySymbol(lpnCoin?.symbol);

  availableCurrencies.value.push(lpnIbcDenom as string);
}

const getAllRewards = async () => {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const contract = CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance;
    const lppClient = new Lpp(cosmWasmClient, contract);

    claimContractData.value.push({
      contractAddress: contract,
      msg: claimRewardsMsg(),
    });

    const lppConfig = await lppClient.getLppConfig();
    const lpnCoin = wallet.getCurrencyByTicker(lppConfig.lpn_ticker);
    const lpnIbcDenom = wallet.getIbcDenomBySymbol(lpnCoin?.symbol);

    availableCurrencies.value.push(lpnIbcDenom as string);

    const lppRewards = await lppClient.getLenderRewards(
      WalletManager.getWalletAddress()
    );

    const coin = wallet.getCurrencyByTicker(lppRewards.rewards.ticker);
    const ibcDenom = wallet.getIbcDenomBySymbol(coin?.symbol);
    rewards.value.push({
      balance: new Coin(ibcDenom as string, lppRewards.rewards.amount),
    });
  } catch (error) {
    console.log(error);
  }
};

const openDelegateUndelegateDialog = () => {
  selectedAsset.value = NATIVE_ASSET.denom;
  showDelegateUndelegateDialog.value = true;
}
</script>
