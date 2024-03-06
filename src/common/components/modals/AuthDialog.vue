<template>
  <DialogHeader
    :back="backButton"
    :headerList="[title]"
  >
    <div class="custom-scroll overflow-auto p-4 pt-8 text-primary md:max-h-[70vh] md:p-8 md:pt-8">
      <AuthComponent
        v-if="view == null"
        :switchView="switchView"
      />
      <template v-else>
        <KeplrComponent
          v-if="view == WalletActions.CONNECT_KEPLR"
          :back="backButton"
          :close="close"
        />
        <LeapComponent
          v-if="view == WalletActions.CONNECT_LEAP"
          :back="backButton"
          :close="close"
        />
        <LedgerComponent
          v-if="view == WalletActions.CONNECT_LEDGER"
          :back="backButton"
          :close="close"
        />
      </template>
    </div>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import AuthComponent from "@/common/components/auth/AuthComponent.vue";
import KeplrComponent from "@/common/components/auth/KeplrComponent.vue";
import LeapComponent from "@/common/components/auth/LeapComponent.vue";
import LedgerComponent from "@/common/components/auth/LedgerComponent.vue";

import { WalletActions } from "@/common/stores/wallet/types";
import { computed, inject, ref } from "vue";
import { useI18n } from "vue-i18n";

const view = ref<WalletActions | null>(null);
const i18n = useI18n();
const close = inject("onModalClose", () => {});

const title = computed(() => {
  switch (view.value) {
    case WalletActions.CONNECT_KEPLR: {
      return i18n.t("message.connecting-kepler");
    }
    case WalletActions.CONNECT_LEAP: {
      return i18n.t("message.connecting-leap");
    }
    case WalletActions.CONNECT_LEDGER: {
      return i18n.t("message.connect-ledger");
    }
  }

  return i18n.t("message.connect-wallet");
});

const backButton = computed<Function | undefined>(() => {
  switch (view.value) {
    case WalletActions.CONNECT_KEPLR: {
      return back;
    }
    case WalletActions.CONNECT_LEAP: {
      return back;
    }
    case WalletActions.CONNECT_LEDGER: {
      return back;
    }
  }

  return undefined;
});

const back = () => {
  view.value = null;
};

const switchView = (type: WalletActions) => {
  view.value = type;
};
</script>
