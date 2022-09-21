<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap mt-[25px] items-center justify-between px-4 lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          Earn
        </h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Portfolio -->
        <div
          class="nolus-box block order-2 order-1 bg-white border-y border-standart radius-medium md:col-span-7 md:mt-6"
        >
          <div
            class="lg:flex block items-center justify-between px-6 pt-6"
          >
            <h2 class="text-16 nls-font-500 text-left my-0">
              {{$t('message.earning-assets')}}
            </h2>
            <div class="right w-full md:w-1/2 mt-[25px] md:mt-0 inline-flex justify-start md:justify-end">
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
                  <label for="show-small-balances">Show small balances</label>
                </div>
              </div>
            </div>
          </div>
          <!-- Assets -->
          <div class="block mt-6 md:mt-[25px]">
            <!-- Assets Header -->
            <div
              class="grid grid-cols-2 gap-6 border-b border-standart pb-3 px-6"
            >
              <div
                class="nls-font-500 text-12 text-dark-grey text-left text-upper"
              >
                {{ $t('message.asset') }}
              </div>

              <div
                class="inline-flex items-center justify-end nls-font-500 text-12 text-dark-grey text-right text-upper"
              >
                <span class="inline-block">{{ $t('message.current-balance') }}</span>
              </div>
            </div>

            <!-- Assets Container -->
            <EarnAsset
              v-for="(asset, index) in balances"
              :key="`${asset.balance.denom}-${index}`"
              :asset="asset"
              :openSupplyWithdraw="() => openSupplyWithdrawDialog(asset.balance.denom)"
              :cols="cols"/>
          </div>
        </div>
        <!-- Portfolio -->
      </div>

      <div class="md:col-span-5 lg:co-span-5">
        <!-- Rewards -->
        <div
          class="nolus-box block order-2 md:order-1 bg-white border-y border-standart radius-medium md:col-span-7 mt-6"
        >
          <div
            class="flex items-center justify-between px-6 pt-6"
          >
            <h2 class="text-16 nls-font-500 text-left my-0">
              Pending rewards
            </h2>
            <button class="btn btn-label btn-large-label">
              Claim all
            </button>
          </div>
          <!-- Assets -->
          <div class="block mt-4">
            <!-- Assets Container -->
            <EarnReward
              :reward="totalNlsRewards()"
              :onClickClaim="onClickClaim"
              :cols="cols"/>
            <!-- Assets Container -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal v-if="showSupplyWithdrawDialog" @close-modal="showSupplyWithdrawDialog = false">
    <SupplyWithdrawDialog :selectedAsset="selectedAsset"/>
  </Modal>
  <Modal v-if="showClaimModal" @close-modal="showClaimModal = false">
    <ClaimDialog :contract-data="this.claimContractData" :reward="totalNlsRewards()"/>
  </Modal>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { claimRewardsMsg, ContractData, Lpp } from '@nolus/nolusjs/build/contracts'
import { ChainConstants, NolusClient } from '@nolus/nolusjs'

import { LPP_CONSTANTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { AssetBalance } from '@/store/modules/wallet/state'
import EarnAsset from '@/components/EarningsComponents/EarnAsset.vue'
import EarnReward from '@/components/EarningsComponents/EarnReward.vue'
import SupplyWithdrawDialog from '@/components/modals/SupplyWithdrawDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import ClaimDialog from '@/components/modals/ClaimDialog.vue'
import { WalletManager } from '@/wallet/WalletManager'
import { Coin, Dec, Int } from '@keplr-wallet/unit'

export default defineComponent({
  name: 'EarningsView',
  components: {
    EarnAsset,
    EarnReward,
    Modal,
    SupplyWithdrawDialog,
    ClaimDialog
  },
  data () {
    return {
      cols: 2 as number,
      showSupplyWithdrawDialog: false,
      availableCurrencies: [] as string[],
      balances: [] as AssetBalance[],
      rewards: [] as AssetBalance[],
      claimContractData: [] as ContractData[],
      selectedAsset: '',
      showSmallBalances: false,
      showClaimModal: false
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.balances = balances.filter(asset => {
          return this.availableCurrencies.includes(asset.balance.denom)
        })
      }
    }
  },
  async mounted () {
    this.getAllRewards()
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()

    for (const [key, value] of Object.entries(LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()])) {
      const lppClient = new Lpp(cosmWasmClient, value.instance)
      this.claimContractData.push({
        contractAddress: value.instance,
        msg: claimRewardsMsg()
      })

      const lppConfig = await lppClient.getLppConfig()
      this.availableCurrencies.push(lppConfig.lpn_symbol)

      const lppRewards = await lppClient.getLenderRewards(WalletManager.getWalletAddress())
      this.rewards.push({ balance: new Coin(lppRewards.rewards.symbol, lppRewards.rewards.amount) })
    }
  },
  methods: {
    onClickClaim () {
      this.showClaimModal = true
    },
    totalNlsRewards (): AssetBalance {
      let totalBalance = new Dec(0)
      this.rewards.forEach(reward => {
        totalBalance = totalBalance.add(reward.balance.amount.toDec())
      })
      return { balance: new Coin(ChainConstants.COIN_MINIMAL_DENOM, totalBalance.truncate()) }
    },
    openSupplyWithdrawDialog (denom: string) {
      this.selectedAsset = denom
      this.showSupplyWithdrawDialog = true
    },
    getAllRewards () {
      for (const [key, value] of Object.entries(LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()])) {

      }
    }
  }
})
</script>
<style scoped></style>
