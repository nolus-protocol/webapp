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
              Earning Assets
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
              v-for="asset in balances"
              :key="asset"
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
            <!-- @TODO: Implement rewards -->
            <EarnReward :cols="cols" :icon="require('@/assets/icons/coins/btc.svg')" asset="BTC" reward="~$5" />
            <EarnReward :cols="cols" :icon="require('@/assets/icons/coins/btc.svg')" asset="BTC" reward="~$5" />
            <EarnReward :cols="cols" :icon="require('@/assets/icons/coins/btc.svg')" asset="BTC" reward="~$5" :loading="true" />
            <!-- Assets Container -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <Modal v-if="showSupplyWithdrawDialog" @close-modal="showSupplyWithdrawDialog = false">
    <SupplyWithdrawDialog :selectedAsset="selectedAsset" />
  </Modal>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Lease } from '@nolus/nolusjs/build/contracts'
import { NolusClient } from '@nolus/nolusjs'

import { CONTRACTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { AssetBalance } from '@/store/modules/wallet/state'
import EarnAsset from '@/components/EarnAsset.vue'
import EarnReward from '@/components/EarningsComponents/EarnReward.vue'
import SupplyWithdrawDialog from '@/components/modals/SupplyWithdrawDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'

export default defineComponent({
  name: 'EarningsView',
  components: {
    EarnAsset,
    EarnReward,
    Modal,
    SupplyWithdrawDialog
  },
  data () {
    return {
      cols: 2 as number,
      showSupplyWithdrawDialog: false,
      availableCurrencies: [] as string[],
      balances: [] as AssetBalance[],
      selectedAsset: '',
      showSmallBalances: false
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
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const leaseClient = new Lease(cosmWasmClient)
    const result = await leaseClient.getLppConfig(CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance)
    this.availableCurrencies.push(result.lpn_symbol)
  },
  methods: {
    openSupplyWithdrawDialog (denom: string) {
      this.selectedAsset = denom
      this.showSupplyWithdrawDialog = true
    }
  }
})
</script>
<style scoped></style>
