<template>
  <div class="col-span-12 lg:mr-[166px]">
    <!-- Header -->
    <div class="table-header flex mt-[25px] flex-wrap items-center justify-between lg:px-0">
      <div class="left">
        <h1 class="text-20 nls-font-700 text-primary m-0 pb-3 lg:pb-0">Assets</h1>
      </div>

      <div class="right md:mt-0 inline-flex justify-end">
        <button class="btn btn-secondary btn-large-secondary mr-4" v-on:click="openModal(DASHBOARD_ACTIONS.SEND)">
          Send / Receive
        </button>

        <button class="btn btn-primary btn-large-primary">
          Buy Tokens
        </button>
      </div>
    </div>
    <!-- Wallet -->
    <div class="flex balance-box items-center justify-start bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm pt-6 pb-3 px-6">
      <div class="left inline-block w-1/3">
        <p class="nls-font-500 text-16 text-primary">
          Total Assets
        </p>
        <p class="nls-font-700 text-32 lg:text-40 text-primary">
          $123,423.00
        </p>

      <div class="separator-line flex py-4 lg:hidden"></div>
      </div>

      <div class="right flex w-2/3 -mt-8 lg:mt-0">
        <div class="pt-3 lg:pl-6">
          <p class="nls-font-400 text-12 text-dark-grey">
            Available Assets
          </p>

          <p class="nls-font-500 text-20">
            {{ calculateTotalBalance() }}
          </p>
        </div>

        <div class="pt-3 pl-12 lg:pl-8">
          <p class="nls-font-400 text-12 text-dark-grey">
            Active Leases
          </p>

          <p class="nls-font-500 text-20">
            $32,423.22
          </p>
        </div>

        <!-- HIDDEN ON MOBILE -->
        <div class="pt-3 pl-12 lg:pl-8 hidden lg:block">
          <p class="nls-font-400 text-12 text-dark-grey">
            Supplied & Staked
          </p>

          <p class="nls-font-500 text-20">
            $32,423.22
          </p>
        </div>

      <!-- HIDDEN ON DESKTOP -->
      </div>
        <div class="pt-4 block lg:hidden">
          <p class="nls-font-400 text-12 text-dark-grey">
            Supplied & Staked
          </p>

          <p class="nls-font-500 text-20">
            $32,423.22
          </p>
        </div>
    </div>

    <!-- Existing Assets -->
    <div class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm">
      <!-- Top -->
      <div class="flex flex-wrap items-baseline justify-between px-4 pt-6">
        <div v-show="showLoading" class="loader-boxed">
          <div class="loader__element"></div>
        </div>
        <div class="left w-1/2">
          <p class="text-16 nls-font-500">
            Available assets
          </p>
        </div>
        <div class="right w-1/2 mt-0 inline-flex justify-end">
          <div class="relative block checkbox-container">
            <div class="flex items-center w-full justify-end">
              <input
                id="show-small-balances"
                v-model="showSmallBalances"
                aria-describedby="show-small-balances"
                name="show-small-balances"
                type="checkbox"/>
              <label for="show-small-balances">Show small balances</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets -->
      <div class="block mt-6 md:mt-[25px]">
        <!-- Assets Header -->
        <div class="grid grid-cols-3 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6">
          <div class="nls-font-500 text-12 text-left text-dark-grey text-upper">
            Assets
          </div>

          <div class="nls-font-500 text-12 text-right text-dark-grey text-upper">
            Price
          </div>

          <div class="hidden md:inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper">
            <span class="inline-block">Earn APR</span>
            <TooltipComponent content="Content goes here"/>
          </div>

          <div class="inline-flex items-center justify-end nls-font-500 text-dark-grey text-12 text-right text-upper">
            <span class="inline-block">Balance</span>
            <TooltipComponent content="Content goes here"/>
          </div>
        </div>

        <!-- Assets Container -->
        <div class="block mb-10 lg:mb-0">
          <AssetPartial
            v-for="(asset, index) in manipulatedAssets"
            :key="`${asset.balance.denom}-${index}`"
            :asset-info="getAssetInfo(asset.balance.denom)"
            :assetBalance="asset.balance.amount.toString()"
            :changeDirection="true"
            :denom="asset.balance.denom"
            :price="getMarketPrice(asset.balance.denom)"
            :openModal="openModal"
            change="4.19"
            earnings="24.34"
          />
        </div>
      </div>
    </div>
  </div>

  <Modal v-if="showModal" @close-modal="showModal = false">
    <component :is="modalOptions[modalAction]" :selectedAsset="selectedAsset"/>
  </Modal>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@nolus/nolusjs'

import AssetPartial from '@/components/AssetPartial.vue'
import { AssetUtils } from '@/utils/AssetUtils'
import { AssetBalance } from '@/store/modules/wallet/state'
import { useStore } from '@/store'
import TooltipComponent from '@/components/TooltipComponent.vue'
import NolusChart from '@/components/templates/utils/NolusChart.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import SupplyWithdrawDialog from '@/components/modals/SupplyWithdrawDialog.vue'
import SendReceiveDialog from '@/components/modals/SendReceiveDialog.vue'
import LeaseDialog from '@/components/modals/LeaseDialog.vue'
import { DASHBOARD_ACTIONS } from '@/types/DashboardActions'

export default defineComponent({
  name: 'DashboardView',
  components: {
    AssetPartial,
    TooltipComponent,
    NolusChart,
    Modal,
    SendReceiveDialog,
    SupplyWithdrawDialog,
    LeaseDialog
  },
  data () {
    return {
      manipulatedAssets: [] as AssetBalance[],
      mainAssets: [] as AssetBalance[],
      showSmallBalances: true,
      showModal: false,
      DASHBOARD_ACTIONS,
      modalOptions: {
        [DASHBOARD_ACTIONS.SEND]: 'SendReceiveDialog',
        [DASHBOARD_ACTIONS.SUPPLY]: 'SupplyWithdrawDialog',
        [DASHBOARD_ACTIONS.LEASE]: 'LeaseDialog'
        // [DASHBOARD_ACTIONS.STAKE]: ''
      },
      modalAction: DASHBOARD_ACTIONS.SEND,
      selectedAsset: '',
      showLoading: true
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances) {
      this.mainAssets = balances
      this.manipulatedAssets = balances
      if (!this.showSmallBalances) {
        this.filterSmallBalances()
      }
      this.showLoading = false
    },
    showSmallBalances () {
      if (!this.showSmallBalances) {
        this.filterSmallBalances()
      } else {
        this.manipulatedAssets = this.mainAssets
      }
    }
  },
  methods: {
    openModal (action: DASHBOARD_ACTIONS, denom = '') {
      this.selectedAsset = denom
      this.modalAction = action
      this.showModal = true
    },
    getAssetInfo (denom: string) {
      return AssetUtils.getAssetInfoByAbbr(denom)
    },
    getMarketPrice (denom: string) {
      const prices = useStore().state.oracle.prices
      if (prices) {
        const tokenDenom = AssetUtils.getAssetInfoByAbbr(denom).coinDenom
        return prices[tokenDenom]?.amount || '0'
      }
      return '0'
    },
    filterSmallBalances () {
      this.manipulatedAssets = this.manipulatedAssets.filter((asset) =>
        asset.balance.amount.gt(new Int('1'))
      )
    },
    calculateTotalBalance () {
      let totalBalance = new Dec(0)
      this.mainAssets.forEach((asset) => {
        const {
          coinDecimals,
          coinDenom
        } = AssetUtils.getAssetInfoByAbbr(
          asset.balance.denom
        )
        const assetBalance = CurrencyUtils.calculateBalance(
          this.getMarketPrice(asset.balance.denom),
          new Coin(coinDenom, asset.balance.amount.toString()),
          coinDecimals
        )
        totalBalance = totalBalance.add(assetBalance.toDec())
      })

      return CurrencyUtils.formatPrice(totalBalance.toString()).toString()
    }
  }
})
</script>
