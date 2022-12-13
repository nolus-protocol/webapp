<template>
  <div class="col-span-12 mb-sm-nolus-70p">
    <!-- Header -->
    <div class="table-header flex mt-[25px] flex-wrap items-center justify-between items-baseline lg:px-0">
      <div class="left">
        <h1 class="text-20 nls-font-700 text-primary m-0">
          {{ $t("message.history") }}
        </h1>
      </div>
    </div>
    <!-- History -->
    <div
      class="block background mt-6 shadow-box radius-medium radius-0-sm overflow-hidden async-loader"
      :class="{'outline': hasOutline}"
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
    <div class="my-4 flex justify-center">
      <button 
        v-if="visible"
        class="btn btn-secondary btn-medium-secondary mx-auto"
        :class="{'js-loading': loading}" 
        @click="load"
      >
        {{ $t("message.load-more") }}
      </button>
    </div>
  </div>
  <Modal 
    v-if="showErrorDialog" 
    @close-modal="showErrorDialog = false" route="alert">
    <ErrorDialog
      :title="$t('error-connecting')"
      :message="errorMessage"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script setup lang="ts">
import type { Coin } from '@cosmjs/proto-signing';

import HistoryTableHeader from '@/components/HistoryComponents/HistoryTableHeader.vue';
import HistoryTableItem from '@/components/HistoryComponents/HistoryTableItem.vue';
import Modal from '@/components/modals/templates/Modal.vue';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';

import { WalletActionTypes } from '@/stores/wallet/action-types';
import { onMounted, ref, watch } from 'vue';
import { useWalletStore } from '@/stores/wallet';
import { storeToRefs } from 'pinia';
import { computed } from '@vue/reactivity';

export interface ITransaction {
  id: string;
  height: number,
  receiver: string;
  sender: string;
  action: string;
  msg: string;
  memo: string;
  blockDate: Date | null;
  fee: Coin[] | null;
}

const showErrorDialog = ref(false);
const errorMessage = ref('');
const transactions = ref([] as ITransaction[]);
const wallet = useWalletStore();
const walletRef = storeToRefs(wallet);

const senderPerPage = 10;
let senderPage = 1;
let senderTotal = 0;

const recipientPerPage = 10;
let recipientPage = 1;
let recipientTotal = 0;

const loading = ref(false);
const loaded = ref(false);
const initialLoad = ref(false);

onMounted(() => {
  getTransactions();
});

const hasOutline = computed(() => {
  if(window.innerWidth > 576){
    return true;
  }
  return transactions.value.length > 0;
});

const visible = computed(() => {
  return initialLoad.value && !loaded.value;
});

const getTransactions = async () => {
  try {

    const res = await wallet[WalletActionTypes.SEARCH_TX]({sender_per_page: senderPerPage, sender_page: senderPage, recipient_per_page: recipientPerPage, recipient_page: recipientPage});
   
    senderPage++;
    recipientPage++;

    senderTotal = res.sender_total as number;
    recipientTotal = res.receiver_total as number;

    transactions.value = res.data as ITransaction[];

    const loadedSender = ( senderPage -1 ) * senderPerPage >= senderTotal;
    const loadedRecepient = ( recipientPage - 1) * recipientPerPage >= recipientTotal;

    if(loadedSender && loadedRecepient){
      loaded.value = true;
    }

    initialLoad.value = true;
    
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }
};

const load = async () => {
  try {
    loading.value = true;
    const loadSender = ( senderPage - 1 ) * senderPerPage <= senderTotal;
    const loadRecepient = ( recipientPage - 1 ) * recipientPerPage <= recipientTotal;


    const res = await wallet[WalletActionTypes.SEARCH_TX]({
      sender_per_page: senderPerPage, 
      sender_page: senderPage, 
      load_sender: loadSender, 
      recipient_per_page: recipientPerPage, 
      recipient_page: recipientPage, 
      load_recipient: loadRecepient
    });

    transactions.value = [...transactions.value, ...res.data];

    if(loadSender){
      senderPage++;
    }

    if(loadRecepient){
      recipientPage++;
    }

    const loadedSender = ( senderPage - 1 ) * senderPerPage <= senderTotal;
    const loadedRecepient = ( recipientPage - 1 ) * recipientPerPage <= recipientTotal;

    if(!loadedSender && !loadedRecepient){
      loaded.value = true;
    }

    senderTotal = res.sender_total as number;
    recipientTotal = res.receiver_total as number;
  } catch (e: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  }finally{
    setTimeout(() => {
      loading.value = false;
    }, 500);
  }
}

const onClickTryAgain = async () => {
  await getTransactions();
};

watch(walletRef.wallet, async () => {
  await getTransactions();
});
</script>
