<template>
  <div class="col-span-12 mb-sm-nolus-70p">
    <!-- Header -->
    <div
      class="table-header flex mt-[25px] flex-wrap items-center justify-between items-baseline lg:px-0"
    >
      <div class="left">
        <h1 class="text-20 nls-font-700 text-primary m-0">
          {{ $t("message.history") }}
        </h1>
      </div>
    </div>
    <!-- History -->
    <div
      class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm overflow-hidden"
    >
      <!-- Assets -->
      <div class="block md:mt-4">
        <HistoryTableHeader />
        <div class="block">
          <HistoryTableItem
            v-for="transaction of transactions"
            :key="transaction.id"
            :transaction="transaction"
          />
        </div>
      </div>
    </div>
  </div>
  <Modal v-if="showErrorDialog" @close-modal="showErrorDialog = false">
    <ErrorDialog
      :title="$t('error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import HistoryTableHeader from '@/components/HistoryComponents/HistoryTableHeader.vue';
import HistoryTableItem from '@/components/HistoryComponents/HistoryTableItem.vue';
import Modal from '@/components/modals/templates/Modal.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';

import type { IndexedTx } from '@cosmjs/stargate';
import { decodeTxRaw, type Coin, type DecodedTxRaw } from '@cosmjs/proto-signing';
import { ChainConstants } from '@nolus/nolusjs';
import { WalletActionTypes } from '@/stores/wallet/action-types';
import { onMounted, ref, watch } from 'vue';

import { useWalletStore } from '@/stores/wallet';
import { storeToRefs } from 'pinia';

export interface ITransaction {
  id: string;
  height?: string,
  receiver: string;
  sender: string;
  action: string;
  memo: string;
  fee: Coin[] | null;
}

const showErrorDialog = ref(false);
const errorMessage = ref('');
const transactions = ref([] as ITransaction[]);
const wallet = useWalletStore();
const walletRef = storeToRefs(wallet);

onMounted(() => {
  getTransactions();
});

const getTransactions = async () => {
  try {
    const res = await wallet[WalletActionTypes.SEARCH_TX]();
    prepareTransactions(res);
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
};

const prepareTransactions = (results: Readonly<IndexedTx[]>) => {
  if (results) {
    transactions.value = [] as ITransaction[];
    results.forEach((tx) => {
      const rawTx = JSON.parse(tx.rawLog);
      const decodedTx: DecodedTxRaw = decodeTxRaw(tx.tx);
      const transactionResult: ITransaction = {
        id: tx.hash || '',
        height: `${tx.height}` || '',
        receiver: rawTx[0].events[3].attributes[0].value || '',
        sender: rawTx[0].events[3].attributes[1].value || '',
        action: rawTx[0].events[3].type || '',
        memo: decodedTx.body.memo || '',
        fee:
          decodedTx?.authInfo?.fee?.amount.filter(
            (coin) => coin.denom === ChainConstants.COIN_MINIMAL_DENOM
          ) || null,
      };
      transactions.value.push(transactionResult);
    });
  }
};

const onClickTryAgain = async () => {
  await getTransactions();
};

watch(walletRef.wallet, async () => {
  await getTransactions();
});
</script>
