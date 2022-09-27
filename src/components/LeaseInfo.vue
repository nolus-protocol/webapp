<template>
  <!-- Leases -->
  <div
    v-if="leaseInfo.leaseStatus"
    class="background mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div
        class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5"
      >
        <div class="flex">
          <img
            :src="require('@/assets/icons/coins/btc.svg')"
            class="inline-block m-0 mr-3"
            height="36"
            width="36"
          />
          <h1 class="text-primary nls-font-700 text-28 md:text-32">
            {{
              this.leaseInfo.leaseStatus?.opened?.amount?.amount || this.leaseInfo.leaseStatus?.paid?.amount || ''
            }}
            <span
              class="inline-block ml-2 text-primary text-large-copy text-14 nls-font-400"
            >{{
                formatLeaseDenom(this.leaseInfo.leaseStatus?.opened?.amount || this.leaseInfo.leaseStatus?.paid)
              }}</span>
          </h1>
        </div>
        {{
          calculateBalance(
            this.leaseInfo.leaseStatus?.opened?.amount?.amount || this.leaseInfo.leaseStatus?.paid?.amount,
            this.leaseInfo.leaseStatus?.opened?.amount?.symbol || this.leaseInfo.leaseStatus?.paid?.symbol
          )
        }}

        <div class="block mt-[25px] pl-12">
          <div class="block">
            <p class="text-detail text-primary m-0">{{ $t('message.outstanding-loan-amount') }}</p>
            <p class="text-primary text-20 nls-font-400 m-0 mt-1">
              {{
                calculateBalance(
                  this.leaseInfo.leaseStatus?.opened?.amount?.amount,
                  this.leaseInfo.leaseStatus?.opened?.amount?.symbol
                )
              }}
            </p>
          </div>
          <div class="block mt-[25px]">
            <p class="text-detail text-primary m-0">{{ $t('message.interest-due') }}</p>
            <p
              class="flex items-center text-primary text-20 nls-font-400 m-0 mt-1"
            >
              {{
                calculateBalance(
                  this.leaseInfo.leaseStatus?.opened?.interest_due?.amount,
                  this.leaseInfo.leaseStatus?.opened?.interest_due?.symbol
                )
              }}
            </p>
          </div>
          <div class="block mt-[25px]">
            <p class="text-detail text-primary m-0">{{ $t('message.interest-rate') }}</p>
            <p class="flex items-center text-primary text-20 nls-font-400 m-0 mt-1">
              {{ formatInterestRate(this.leaseInfo.leaseStatus?.opened?.interest_rate) }}
            </p>
          </div>
        </div>
      </div>
      <div class="lg:col-span-2 px-6 pt-5">
        <!-- Graph -->
      </div>
    </div>
    <div
      class="flex items-center justify-end border-t border-standart pt-4 px-6"
    >
      <button class="btn btn-secondary btn-large-secondary" v-if="leaseInfo.leaseStatus.opened"
              v-on:click="showRepayModal = true">
        {{
          $t('message.repay')
        }}
      </button>

      <button class="btn btn-secondary btn-large-secondary" v-if="leaseInfo.leaseStatus.paid"
              v-on:click="onClickClaim(this.leaseInfo?.leaseAddress)">
        {{
          $t('message.claim')
        }}
      </button>
    </div>
  </div>

  <Modal v-if="showRepayModal" @close-modal="showRepayModal = false">
    <RepayDialog :lease-info="leaseInfo"/>
  </Modal>
</template>

<script lang="ts">
import { PropType } from 'vue'
import { Asset, Lease } from '@nolus/nolusjs/build/contracts'
import { CurrencyUtils, NolusClient } from '@nolus/nolusjs'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { Coin, Dec, Int } from '@keplr-wallet/unit'

import { assetsInfo } from '@/config/assetsInfo'
import { useStore } from '@/store'
import { LeaseData } from '@/types/LeaseData'
import RepayDialog from '@/components/modals/RepayDialog.vue'
import { WalletUtils } from '@/utils/WalletUtils'
import Modal from '@/components/modals/templates/Modal.vue'

export default {
  name: 'LeaseInfo',
  components: { RepayDialog, Modal },
  props: {
    leaseInfo: {
      type: Object as PropType<LeaseData>
    }
  },
  data () {
    return {
      showRepayModal: false
    }
  },
  methods: {
    async onClickClaim (leaseAddress: string) {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
      const leaseClient = new Lease(cosmWasmClient)
      const coinDecimals = new Int(10).pow(new Int(6).absUInt())
      const feeAmount = new Dec('0.25').mul(new Dec(coinDecimals))
      const DEFAULT_FEE = {
        amount: [{
          denom: ChainConstants.COIN_MINIMAL_DENOM,
          amount: WalletUtils.isConnectedViaExtension() ? '0.25' : feeAmount.truncate().toString()
        }],
        gas: '2000000'
      }

      const wallet = useStore().getters.getNolusWallet

      if (wallet) {
        const result = await leaseClient.closeLease(leaseAddress, wallet, DEFAULT_FEE, undefined)
        console.log('result exec: ', result)
      }
    },
    formatLeaseDenom (asset: Asset) {
      if (asset) {
        const assetInfo = assetsInfo[asset.symbol]
        return assetInfo.coinDenom
      }

      return ''
    },
    formatInterestRate (interestRatePromile: number) {
      return new Dec(interestRatePromile).quo(new Dec(10)).toString(1) + '%'
    },
    calculateBalance (tokenAmount: string, denom: string) {
      const prices = useStore().getters.getPrices
      const assetInf = assetsInfo[denom]
      if (prices && assetInf) {
        const coinPrice = prices[assetInf.coinDenom]?.amount || '0'
        const tokenDecimals = assetInf.coinDecimals
        const coinAmount = new Coin(denom, new Int(tokenAmount))
        return CurrencyUtils.calculateBalance(
          coinPrice,
          coinAmount,
          0
        ).toString()
      }

      return CurrencyUtils.calculateBalance(
        '0',
        new Coin('', new Int(0)),
        0
      ).toString()
    }
  }
}
</script>
