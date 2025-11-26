<template>
  <TermsDialog ref="terms" />
  <div class="flex flex-col gap-4 px-6 pb-6">
    <div class="text-[14px] text-neutral-400">
      {{ $t("message.policy") }}
      <button
        class="text-primary-50"
        @click="onShowTermsModal"
      >
        {{ $t("message.terms-of-service") }}
      </button>
    </div>
    <div class="flex flex-col gap-2">
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
      <button
        @click="router.push('learn-wallet')"
        target="_blank"
        class="flex items-center gap-1 text-typography-link"
      >
        {{ $t("message.learn-more") }}
        <SvgIcon
          name="arrow-external"
          size="xs"
          class="fill-icon-link"
        />
      </button>
    </p>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SvgIcon } from "web-components";
import { WalletActions } from "@/common/stores/wallet";

import WalletBoxes from "./WalletBoxes.vue";
import TermsDialog from "../dialogs/TermsDialog.vue";
import KeplrIcon from "@/assets/icons/wallets/keplr.svg?url";
import LedgerIcon from "@/assets/icons/wallets/ledger.svg?url";
import LeapIcon from "@/assets/icons/wallets/leapwallet.svg?url";
import WalletConnectIcon from "@/assets/icons/wallets/walletconnect.svg?url";
import MetamaskIcon from "@/assets/icons/wallets/metamask.svg?url";

import { useRouter } from "vue-router";

const i18n = useI18n();
const terms = ref<typeof TermsDialog>();
const router = useRouter();

const connections = computed(
  (): Record<
    string,
    {
      icon: string;
      label: string;
      type: WalletActions;
    }
  > => {
    return {
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
      // EvmMetamask: {
      //   icon: MetamaskIcon,
      //   label: i18n.t("message.metamask"),
      //   type: WalletActions.CONNECT_EVM_METAMASK
      // },
      Ledger: {
        icon: LedgerIcon,
        label: i18n.t("message.ledger"),
        type: WalletActions.CONNECT_LEDGER
      },
      WalletConnect: {
        icon: WalletConnectIcon,
        label: i18n.t("message.keplr-wallet-connect"),
        type: WalletActions.CONNECT_WC
      }
    };
  }
);

function onShowTermsModal() {
  terms.value?.show();
}
</script>
