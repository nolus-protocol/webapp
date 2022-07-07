<template>
  <div
    v-cloak
    class="lg:container w-full lg:grid lg:grid-cols-12 mx-auto grid-parent md-nls-px-25 sm-nls-0 body"
  >
    <div class="lg:col-span-3">
      <SidebarContainer/>
    </div>
    <div class="lg:col-span-9 pb-8">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-nolus-60">
          <div class="col-span-12">
            <div class="sidebar-header">
              <SidebarHeader/>
            </div>
          </div>
        </div>
        <div class="col-span-12">
          <!-- Header -->
          <div
            class="table-header flex mt-nolus-255 flex-wrap items-center justify-between items-baseline lg:px-0"
          >
            <div class="left">
              <h1 class="nls-20 nls-font-700 text-primary m-0">History</h1>
            </div>
          </div>
          <!-- History -->
          <div
            class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm overflow-hidden"
          >
            <!-- Assets -->
            <div class="block md:mt-4">
              <!-- Assets Header -->
              <div
                class="nls-sm-hidden md:grid grid-cols-12 flex items-center gap-6 border-b border-standart pb-3 px-6"
              >
                <div
                  class="col-span-2 hidden lg:block nls-font-500 nls-12 text-dark-grey text-left text-upper"
                >
                  ID
                </div>
                <div
                  class="lg:col-span-2 col-span-3 block invisible lg:visible nls-font-500 nls-12 text-dark-grey text-left text-upper"
                >
                  Type
                </div>
                <div
                  class="flex items-center col-span-4 col-span-2 justify-start nls-font-500 nls-12 text-dark-grey lg:text-left text-upper"
                >
                  <span class="inline-block">Action</span>
                </div>
                <div
                  class="md:flex lg:col-span-2 col-span-3 items-center justify-end nls-font-500 nls-12 text-dark-grey text-right text-upper"
                >
                  <span class="inline-block">Fee</span>
                </div>
                <div
                  class="md:flex col-span-2 items-center justify-end nls-font-500 nls-12 text-dark-grey text-right text-upper"
                >
                  <span class="inline-block">Time</span>
                </div>
              </div>
              <!-- Assets Container -->
              <div class="block">
                <!-- History Element -->
                <div
                  class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6 md:flex items-center"
                >
                  <div
                    class="nls-sm-hidden block col-span-3 lg:col-span-2 nls-14 nls-font-400 text-primary text-left"
                  >
                    C1FAC987E9515B...
                  </div>
                  <div class="hidden lg:block col-span-2 text-left">
                    <span
                      class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill"
                    >
                      Transfer
                    </span>
                  </div>
                  <div
                    class="block col-span-5 lg:col-span-4 text-primary text-left"
                  >
                    <span class="nls-12 nls-font-700"
                    >Stake 797020...qtcrpy to Pylon Governance</span
                    >
                    <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
                    <!--                    class="text-bold">Pylon Governance</span>-->
                  </div>
                  <div
                    class="block col-span-2 items-center justify-start md:justify-end nls-sm-inline-flex-half"
                  >
                    <span
                      class="left-and-right nls-14 nls-font-400 text-primary mt-nls-sm-9"
                    >
                      0.481215 NLS
                    </span>
                  </div>
                  <div
                    class="mt-nls-sm-9 flex col-span-2 items-center justify-end nls-14 nls-font-400 text-primary text-right nls-sm-inline-flex-half"
                  >
                    2 hours ago
                  </div>
                </div>
              </div>
              <div class="block">
                <!-- History Element -->
                <div
                  class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6 md:flex items-center"
                >
                  <div
                    class="nls-sm-hidden block col-span-3 lg:col-span-2 nls-14 nls-font-400 text-primary text-left"
                  >
                    C1FAC987E9515B...
                  </div>
                  <div class="hidden lg:block col-span-2 text-left">
                    <span
                      class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill"
                    >
                      Transfer
                    </span>
                  </div>
                  <div
                    class="block col-span-5 lg:col-span-4 text-primary text-left"
                  >
                    <span class="nls-12 nls-font-700"
                    >Send 139UST to Pylon Governance</span
                    >
                    <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
                    <!--                    class="text-bold">Pylon Governance</span>-->
                  </div>
                  <div
                    class="block col-span-2 items-center justify-start md:justify-end nls-sm-inline-flex-half"
                  >
                    <span
                      class="left-and-right nls-14 nls-font-400 text-primary mt-nls-sm-9"
                    >
                      0.481215 NLS
                    </span>
                  </div>
                  <div
                    class="mt-nls-sm-9 flex col-span-2 items-center justify-end nls-14 nls-font-400 text-primary text-right nls-sm-inline-flex-half"
                  >
                    2 hours ago
                  </div>
                </div>
              </div>
              <div class="block">
                <!-- History Element -->
                <div
                  class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6 md:flex items-center"
                >
                  <div
                    class="nls-sm-hidden block col-span-3 lg:col-span-2 nls-14 nls-font-400 text-primary text-left"
                  >
                    C1FAC987E9515B...
                  </div>
                  <div class="hidden lg:block col-span-2 text-left">
                    <span
                      class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill"
                    >
                      Transfer
                    </span>
                  </div>
                  <div
                    class="block col-span-5 lg:col-span-4 text-primary text-left"
                  >
                    <span class="nls-12 nls-font-700"
                    >Stake 797020...qtcrpy to Pylon Governance</span
                    >
                    <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
                    <!--                    class="text-bold">Pylon Governance</span>-->
                  </div>
                  <div
                    class="block col-span-2 items-center justify-start md:justify-end nls-sm-inline-flex-half"
                  >
                    <span
                      class="left-and-right nls-14 nls-font-400 text-primary mt-nls-sm-9"
                    >
                      0.481215 NLS
                    </span>
                  </div>
                  <div
                    class="mt-nls-sm-9 flex col-span-2 items-center justify-end nls-14 nls-font-400 text-primary text-right nls-sm-inline-flex-half"
                  >
                    2 hours ago
                  </div>
                </div>
              </div>
              <!-- here -->
              <div class="block">
                <!-- History Element -->
                <div
                  class="grid lg:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6"
                  v-for="transaction in this.transactions"
                  :key="transaction.id"
                >
                  <div
                    class="hidden col-span-2 lg:block nls-14 nls-font-400 text-primary text-left"
                  >
                    {{ truncateString(transaction.id) }}
                  </div>
                  <div class="hidden col-span-2 md:block text-left">
                    <span
                      class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill"
                    >
                      {{ capitalize(transaction.action) }}
                    </span>
                  </div>
                  <div
                    class="block col-span-4 nls-14 nls-font-400 text-primary text-left"
                  >
                    <span class="nls-12 nls-font-700">
                      {{ truncateString(transaction.sender) }}
                      to
                      {{ truncateString(transaction.receiver) }}
                    </span>
                    <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
                    <!--                    class="text-bold">Pylon Governance</span>-->
                  </div>
                  <div
                    class="block col-span-2 items-center justify-start md:justify-endtext-primary"
                  >
                    <span class="left-and-right nls-14 nls-font-400">{{
                        convertFeeAmount(transaction.fee)
                      }}</span>
                  </div>
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
import { IndexedTx } from '@cosmjs/stargate'
import { Coin, DecodedTxRaw, decodeTxRaw } from '@cosmjs/proto-signing'
import { StringUtils } from '@/utils/StringUtils'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { ChainConstants, CurrencyUtils } from '@nolus/nolusjs'
import SidebarHeader from '@/components/Sideheader.vue'

interface ITransaction {
  id: string;
  receiver: string;
  sender: string;
  action: string;
  memo: string;
  fee: Coin[] | null;
}

export default defineComponent({
  name: 'HistoryView',
  components: {
    SidebarContainer,
    SidebarHeader
  },
  data () {
    return {
      transactions: [] as ITransaction[]
    }
  },
  watch: {
    '$store.state.wallet.wallet' () {
      this.getTransactions()
      console.log('FROM HISTORY', this.transactions)
    }
  },
  mounted () {
    this.getTransactions()
  },
  methods: {
    async getTransactions () {
      const res = await useStore().dispatch(WalletActionTypes.SEARCH_TX)
      this.prepareTransactions(res)
    },
    prepareTransactions (results: readonly IndexedTx[]) {
      if (results) {
        results.forEach((tx) => {
          const rawTx = JSON.parse(tx.rawLog)
          const decodedTx: DecodedTxRaw = decodeTxRaw(tx.tx)
          const transactionResult: ITransaction = {
            id: tx.hash || '',
            receiver: rawTx[0].events[3].attributes[0].value || '',
            sender: rawTx[0].events[3].attributes[1].value || '',
            action: rawTx[0].events[3].type || '',
            memo: decodedTx.body.memo || '',
            fee:
              decodedTx?.authInfo?.fee?.amount.filter(
                (coin) => coin.denom === ChainConstants.COIN_MINIMAL_DENOM
              ) || null
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
    },
    capitalize (value: string) {
      return StringUtils.capitalize(value)
    }
  }
})
</script>
