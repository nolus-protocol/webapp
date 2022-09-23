<template>
  <div class="col-span-12 mb-sm-nolus-70p">
    <!-- Header -->
    <div class="table-header flex mt-[25px] flex-wrap items-center justify-between items-baseline lg:px-0">
      <div class="left">
        <h1 class="text-20 nls-font-700 text-primary m-0">
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
  <Modal v-if="this.showErrorDialog" @close-modal="this.showErrorDialog = false">
    <ErrorDialog title="Error connecting" :message="this.errorMessage" :try-button="onClickTryAgain"/>
  </Modal>
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
import Modal from '@/components/modals/templates/Modal.vue'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'

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
    HistoryTableItem,
    Modal,
    ErrorDialog
  },
  data () {
    return {
      showErrorDialog: false,
      errorMessage: '',
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
    async onClickTryAgain () {
      await this.getTransactions()
    },
    async getTransactions () {
      try {
        const res = await useStore().dispatch(WalletActionTypes.SEARCH_TX)
        this.prepareTransactions(res)
      } catch (e: any) {
        this.showErrorDialog = true
        this.errorMessage = e.message
      }
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
