<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div
      class="flex flex-wrap mt-[25px] items-center justify-between px-4 lg:px-0"
    >
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">Earn</h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Portfolio -->
        <div
          class="nolus-box block order-2 order-1 background border-y border-standart radius-medium md:col-span-7 md:mt-6 async-loader"
        >
          <div class="lg:flex block items-center justify-between px-6 pt-6">
            <h2 class="text-16 nls-font-500 text-left my-0">
              {{ $t("message.earning-assets") }}
            </h2>
            <div
              class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end"
            >
              <div class="relative block checkbox-container">
                <div class="flex items-center w-full justify-end">
                  <input
                    id="show-small-balances"
                    v-model="showSmallBalances"
                    aria-describedby="show-small-balances"
                    name="show-small-balances"
                    type="checkbox"
                    disabled="true" 
                  />
                  <label for="show-small-balances">{{ $t('message.show-small-balances') }}</label>
                </div>
              </div>
            </div>
          </div>
          <!-- Assets -->
          <div class="block mt-6 md:mt-[25px]">
            <!-- Assets Header -->
            <div
              class="grid grid-cols-2 md:grid-cols-3 gap-6 border-b border-standart pb-3 px-6"
            >
              <div
                class="nls-font-500 text-12 text-dark-grey text-left text-upper"
              >
                {{ $t("message.asset") }}
              </div>

              <div
                class="nls-font-500 text-12 text-dark-grey text-center text-upper"
              >
                {{ $t("message.apr") }}
              </div>

              <div
                class="inline-flex items-center justify-end nls-font-500 text-12 text-dark-grey text-right text-upper"
              >
                <span class="inline-block">{{
                  $t("message.current-balance")
                }}</span>
              </div>
            </div>

            <!-- Assets Container -->
            <EarnAsset
              v-for="(asset, index) in balances"
              :key="`${asset.balance.denom}-${index}`"
              :asset="asset"
              :openSupplyWithdraw="
                () => openSupplyWithdrawDialog(asset.balance.denom)
              "
              :cols="cols"
            />
          </div>
        </div>
        <!-- Portfolio -->
      </div>

      <div class="md:col-span-5 lg:co-span-5">
        <!-- Rewards -->
        <div
          class="nolus-box block order-2 md:order-1 background border-y border-standart radius-medium md:col-span-7 mt-6"
        >
          <div class="flex items-center justify-between px-6 pt-6">
            <h2 class="text-16 nls-font-500 text-left my-0">{{ $t('message.rewards') }}</h2>
            <button class="btn-label btn-large-label">{{ $t('message.claim-all') }}</button>
          </div>
          <!-- Assets -->
          <div class="block mt-4">
            <!-- Assets Container -->
            <EarnReward
              :reward="totalNlsRewards()"
              :onClickClaim="onClickClaim"
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
    @close-modal="showSupplyWithdrawDialog = false"
    route="supply"
  >
    <SupplyWithdrawDialog :selectedAsset="selectedAsset" />
  </Modal>
  <Modal v-if="showClaimModal" @close-modal="showClaimModal = false" route="claim">
    <ClaimDialog
      :contract-data="claimContractData"
      :reward="totalNlsRewards()"
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

<script setup lang="ts">
import EarnAsset from '@/components/EarningsComponents/EarnAsset.vue';
import EarnReward from '@/components/EarningsComponents/EarnReward.vue';
import SupplyWithdrawDialog from '@/components/modals/SupplyWithdrawDialog.vue';
import Modal from '@/components/modals/templates/Modal.vue';
import ClaimDialog from '@/components/modals/ClaimDialog.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';

import type { AssetBalance } from '@/stores/wallet/state';
import { onMounted, ref, watch } from 'vue';
import { claimRewardsMsg, type ContractData, Lpp} from '@nolus/nolusjs/build/contracts';
import { ChainConstants, NolusClient } from '@nolus/nolusjs';

import { CONTRACTS } from '@/config/contracts';
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils';

import { WalletManager } from '@/wallet/WalletManager';
import { Coin, Dec } from '@keplr-wallet/unit';
import { storeToRefs } from 'pinia';
import { useWalletStore } from '@/stores/wallet';

const wallet = useWalletStore();
const walletRef = storeToRefs(wallet);

const cols = ref(3 as number);
const showSupplyWithdrawDialog = ref(false);
const availableCurrencies = ref([] as string[]);
const balances = ref([] as AssetBalance[]);
const rewards = ref([] as AssetBalance[]);
const claimContractData = ref([] as ContractData[]);
const selectedAsset = ref('');
const showSmallBalances = ref(false);
const showClaimModal = ref(false);
const showErrorDialog = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  try {
    await getAllRewards();
    balances.value = wallet.balances.filter((asset) => {
      return availableCurrencies.value.includes(asset.balance.denom);
    });

  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
});

const onClickTryAgain = async () => {
  await getAllRewards();
};

const onClickClaim = () => {
  showClaimModal.value = true;
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

const getAllRewards = async () => {
  try{
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const contract = CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance;
    const lppClient = new Lpp(cosmWasmClient, contract);

      claimContractData.value.push({
        contractAddress: contract,
        msg: claimRewardsMsg(),
      });

      const lppConfig = await lppClient.getLppConfig();
      const lpnCoin = wallet.getCurrencyByTicker(lppConfig.lpn_ticker);
      const lpnIbcDenom = wallet.getIbcDenomBySymbol(lpnCoin.symbol);

      availableCurrencies.value.push(lpnIbcDenom as string);

      const lppRewards = await lppClient.getLenderRewards(
        WalletManager.getWalletAddress()
      );

      const coin = wallet.getCurrencyByTicker(lppRewards.rewards.ticker);
      const ibcDenom = wallet.getIbcDenomBySymbol(coin.symbol);
      rewards.value.push({
        balance: new Coin(ibcDenom as string, lppRewards.rewards.amount),
      });

  }catch(error){

  }

};

watch(walletRef.balances, async (balanceValue: AssetBalance[]) => {
  if (balances) {
    balances.value = balanceValue.filter((asset) => {
      return availableCurrencies.value.includes(asset.balance.denom);
    });
  }
});

</script>
