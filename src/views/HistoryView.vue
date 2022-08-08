<template>
  <div class="col-span-12 mb-sm-nolus-70p">
    <!-- Header -->
    <div class="table-header flex mt-[25px] flex-wrap items-center justify-between items-baseline lg:px-0">
      <div class="left">
        <h1 class="nls-20 nls-font-700 text-primary m-0">
          {{ $t('message.history') }}
        </h1>
      </div>
    </div>
    <!-- History -->
    <div class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm overflow-hidden">
      <!-- Assets -->
      <div class="block md:mt-4">
        <HistoryTableHeader/>
        <div class="block">
          <HistoryTableItem v-for="transaction of transactions" :key="transaction.id"
                            :transaction="transaction"/>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { IndexedTx } from '@cosmjs/stargate'
import { Coin, DecodedTxRaw, decodeTxRaw } from '@cosmjs/proto-signing'
import { ChainConstants } from '@nolus/nolusjs'

import HistoryTableHeader from '@/components/HistoryComponents/HistoryTableHeader.vue'
import HistoryTableItem from '@/components/HistoryComponents/HistoryTableItem.vue'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'

export interface ITransaction {
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
    HistoryTableHeader,
    HistoryTableItem
  },
  data () {
    return {
      transactions: [] as ITransaction[]
    }
  },
  watch: {
    '$store.state.wallet.wallet' () {
      this.getTransactions()
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
        this.transactions = []
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
    }
  }
})
</script>
