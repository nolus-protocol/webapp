<template>
  <div class="page-container home">
    <div class="none">
      <SidebarContainer>
      </SidebarContainer>
    </div>

    <div class="container mx-auto pt-24 lg:pt-16">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-start-3 lg:col-span-9">
          <!-- Header -->
          <div class="flex flex-wrap items-center justify-between px-4 md:px-0">
            <div class="left w-full md:w-1/2">
              <h1 class="text-default-heading text-primary m-0">History</h1>
            </div>
            <div class="right w-full md:w-1/2 mt-4 md:mt-0 inline-flex justify-start md:justify-end">
            </div>
          </div>

          <!-- History -->
          <div class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm overflow-hidden">

            <!-- Assets -->
            <div class="block md:mt-4">

              <!-- Assets Header -->
              <div class="hidden md:grid md:grid-cols-4 lg:grid-cols-5 gap-6 border-b border-standart pb-3 px-6">

                <div class="hidden lg:block text-medium text-detail text-dark-grey text-left text-upper">
                  ID
                </div>

                <div class="hidden md:block text-medium text-detail text-dark-grey text-left text-upper">
                  Type
                </div>

                <div
                  class="flex items-center justify-start text-medium text-detail text-dark-grey text-left text-upper">
                  <span class="inline-block">Action</span>
                </div>

                <div
                  class="hidden md:flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
                  <span class="inline-block">Fee</span>
                </div>

                <div
                  class="hidden md:flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
                  <span class="inline-block">Time</span>
                </div>
              </div>

              <!-- Assets Container -->
              <div class="block pt-3">

                <!-- History Element -->
                <div class="grid grid-cols-2  md:grid-cols-4 lg:grid-cols-5 gap-6 border-b border-standart pb-3 px-6"
                     v-for="transaction in this.transactions">

                  <div class="hidden lg:block text-regular text-detail text-primary text-left">
                    {{ truncateString(transaction.id) }}
                  </div>

                  <div class="hidden md:block text-medium text-detail text-primary text-left">
                  <span class="inline-block py-1 px-2 text-patch radius-pill">
                    {{ transaction.action }}
                  </span>
                  </div>

                  <div class="block col-span-2 md:col-span-1 text-regular text-detail text-primary text-left">
                    {{ truncateString(transaction.sender) }}
                    <span class="text-bold"> to </span>
                    {{ truncateString(transaction.receiver) }}
                    <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
                    <!--                    class="text-bold">Pylon Governance</span>-->
                  </div>

                  <div
                    class="block col-span-1 items-center justify-start md:justify-end text-regular text-detail text-primary">
                    <span class="left-and-right">{{ convertFeeAmount(transaction.fee) }}</span>
                  </div>

                  <!--                  <div-->
                  <!--                    class="flex col-span-1 items-center justify-end text-regular text-detail text-primary text-right">-->
                  <!--                    2 hours ago-->
                  <!--                  </div>-->
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SidebarContainer from '@/components/SidebarContainer.vue'
import store from '@/store'
import { IndexedTx } from '@cosmjs/stargate'
import { Coin, DecodedTxRaw, decodeTxRaw } from '@cosmjs/proto-signing'
import { COIN_MINIMAL_DENOM } from '@/constants/chain'
import { StringUtils } from '@/utils/StringUtils'
import { CurrencyUtils } from '@/utils/CurrencyUtils'

interface ITransaction {
  id: string,
  receiver: string,
  sender: string,
  action: string,
  memo: string,
  fee: Coin[] | null
}

export default defineComponent({
  name: 'HistoryView',
  components: {
    SidebarContainer
  },
  data () {
    return {
      transactions: [] as ITransaction[]
    }
  },
  watch: {
    async '$store.state.wallet' () {
      console.log('dada', store.state.wallet.address)
      this.getTransactions()
    }
  },
  mounted () {
    this.getTransactions()
  },
  methods: {
    async getTransactions () {
      const res = await store.state.wallet?.searchTx({ sentFromOrTo: store.state.wallet.address || '' })
      console.log(this.transactions)
      this.prepareTransactions(res)
    },
    prepareTransactions (results: readonly IndexedTx[]) {
      if (results) {
        (results).forEach((tx) => {
          const rawTx = JSON.parse(tx.rawLog)
          const decodedTx: DecodedTxRaw = decodeTxRaw(tx.tx)
          const transactionResult: ITransaction = {
            id: tx.hash || '',
            receiver: rawTx[0].events[3].attributes[0].value || '',
            sender: rawTx[0].events[3].attributes[1].value || '',
            action: rawTx[0].events[3].type || '',
            memo: decodedTx.body.memo || '',
            fee: decodedTx?.authInfo?.fee?.amount.filter(coin => coin.denom === COIN_MINIMAL_DENOM) || null
          }
          this.transactions.push(transactionResult)
        })
      }
    },
    truncateString (text: string) {
      return StringUtils.truncateString(text, 10, 6)
    },
    convertFeeAmount (fee: Coin[]) {
      const convertFee = CurrencyUtils.convertCosmosCoinToKeplCoin(fee[0])
      const feeAmount = CurrencyUtils.convertCoinUNolusToNolus(convertFee)
      return feeAmount?.toString()
    }
  }
})
</script>
