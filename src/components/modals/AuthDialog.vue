<template>
  <DialogHeader
    :back="backButton"
    :headerList="[title]"
  >
    <div class="overflow-auto md:max-h-[70vh] text-primary md:p-8 md:pt-8 pt-8 p-4 custom-scroll">
      <AuthComponent
        v-if="view == null"
        :switchView="switchView"
      />
      <template v-else>
        <KeplrComponent
          :back="backButton"
          :close="close"
          v-if="view == WalletActionTypes.CONNECT_KEPLR"
        />
        <LeapComponent
          :back="backButton"
          :close="close"
          v-if="view == WalletActionTypes.CONNECT_LEAP"
        />
        <LedgerComponent
          :back="backButton"
          :close="close"
          v-if="view == WalletActionTypes.CONNECT_LEDGER"
        />
      </template>
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/components/modals/templates/DialogHeader.vue";
import AuthComponent from "@/components/AuthComponents/AuthComponent.vue";
import KeplrComponent from "../AuthComponents/KeplrComponent.vue";
import LeapComponent from "../AuthComponents/LeapComponent.vue";
import LedgerComponent from "../AuthComponents/LedgerComponent.vue";

import { WalletActionTypes } from "@/stores/wallet";
import { computed, inject, ref } from "vue";
import { useI18n } from "vue-i18n";

const view = ref<WalletActionTypes | null>(null);
const i18n = useI18n();
const close = inject('onModalClose', () => {});

const title = computed(() => {

  switch (view.value) {
    case (WalletActionTypes.CONNECT_KEPLR): {
      return i18n.t('message.connecting-kepler');
    }
    case (WalletActionTypes.CONNECT_LEAP): {
      return i18n.t('message.connecting-leap');
    }
    case (WalletActionTypes.CONNECT_LEDGER): {
      return i18n.t('message.connect-ledger');
    }
  }

  return i18n.t('message.connect-wallet');

});

const backButton = computed(() => {

  switch (view.value) {
    case (WalletActionTypes.CONNECT_KEPLR): {
      return back;
    }
    case (WalletActionTypes.CONNECT_LEAP): {
      return back;
    }
    case (WalletActionTypes.CONNECT_LEDGER): {
      return back;
    }
  }

});

const back = () => {
  view.value = null;
}

const switchView = (type: WalletActionTypes) => {
  view.value = type;
}

</script>