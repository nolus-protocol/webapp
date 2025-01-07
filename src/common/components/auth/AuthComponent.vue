<template>
  <div class="flex flex-col gap-4 px-6 pb-6">
    <div class="text-[13px] text-neutral-400">
      {{ $t("message.policy") }}
      <button
        class="text-primary-50"
        @click="onShowTermsModal"
      >
        {{ $t("message.terms-of-service") }}
      </button>
    </div>
    <div class="flex flex-col gap-2 lg:grid lg:grid-cols-2">
      <WalletBoxes
        v-for="connection in connections"
        :key="connection.label"
        :icon="connection.icon"
        :label="connection.label"
        :type="connection.type"
      />
    </div>
    <p class="font- flex items-center justify-center gap-1 text-14 font-semibold text-typography-secondary">
      {{ $t("message.new-with-wallets") }}
      <a
        href="#"
        target="_blank"
        class="flex items-center gap-1 text-typography-link"
      >
        {{ $t("message.learn-more") }}
        <SvgIcon
          name="arrow-external"
          size="xs"
          class="fill-icon-link"
        />
      </a>
    </p>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { SvgIcon } from "web-components";
import WalletBoxes from "./WalletBoxes.vue";

import KeplrIcon from "@/assets/icons/wallets/keplr.svg";
import LedgerIcon from "@/assets/icons/wallets/ledger.svg";
import LeapIcon from "@/assets/icons/wallets/leapwallet.svg";
import MetamaskIcon from "@/assets/icons/wallets/metamask.svg";
import { WalletActions } from "@/common/stores/wallet";

const i18n = useI18n();
const showTermsModal = ref(false);

const connections = {
  Keplr: {
    icon: KeplrIcon,
    label: i18n.t("message.keplr"),
    type: WalletActions.CONNECT_KEPLR
  },
  Leap: {
    icon: LeapIcon,
    label: i18n.t("message.leap"),
    type: WalletActions.CONNECT_LEAP
  },
  Ledger: {
    icon: LedgerIcon,
    label: i18n.t("message.ledger"),
    type: WalletActions.CONNECT_LEDGER
  },
  Metamask: {
    icon: MetamaskIcon,
    label: i18n.t("message.metamask"),
    type: undefined
  }
};

function onShowTermsModal() {
  showTermsModal.value = true;
}
</script>
