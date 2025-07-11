<template>
  <Button
    ref="popoverParent"
    class="h-full"
    size="small"
    :label="isMobile() ? '' : StringUtils.truncateString(wallet?.wallet?.address ?? '', 8, 4)"
    severity="secondary"
    icon="wallet"
    icon-position="left"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :show-close="isMobile()"
    :parent="popoverParent"
    @close="isOpen = !isOpen"
    :title="$t('message.wallets')"
  >
    <template #content>
      <div class="mx-4 mb-4 rounded-md border border-border-color text-typography-default">
        <div class="flex items-center justify-between border-b border-border-color px-4 py-2">
          <div class="flex items-center gap-2 text-14 font-semibold">
            <component :is="connection?.icon" />
            {{ connection?.label }}
          </div>
          <div class="flex items-center gap-1 text-12 font-normal">
            <i class="h-1 w-1 rounded-full bg-icon-success" />
            {{ $t("message.online") }}
          </div>
        </div>
        <div class="flex w-full items-center justify-between rounded-md bg-neutral-bg-1 px-4 py-2">
          <div class="flex w-full gap-2">
            <img
              width="32"
              :src="NolusIcon"
            />
            <div class="flex flex-col text-typography-secondary">
              <span class="text-14 font-semibold">
                {{
                  isMobile()
                    ? StringUtils.truncateString(wallet?.wallet?.address ?? "", 8, 8)
                    : StringUtils.truncateString(wallet?.wallet?.address ?? "", 16, 16)
                }}
              </span>
              <span class="text-12 font-normal">{{ NATIVE_NETWORK.label }}</span>
            </div>
            <div class="flex flex-1 items-center justify-end">
              <Button
                severity="tertiary"
                icon="copy"
                size="small"
                class="!p-2.5 text-icon-default"
                @click="onCopy"
              />

              <Button
                severity="tertiary"
                icon="trash"
                size="small"
                class="!p-2.5 text-icon-default"
                @click="onClickDisconnect"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { type FunctionalComponent, inject, ref } from "vue";
import { Button, Popover, ToastType } from "web-components";
import { isMobile, StringUtils, WalletManager } from "@/common/utils";
import { NATIVE_NETWORK } from "@/config/global";
import { useI18n } from "vue-i18n";

import KeplrIcon from "@/assets/icons/wallets/keplr.svg";
import LedgerIcon from "@/assets/icons/wallets/ledger.svg";
import LeapIcon from "@/assets/icons/wallets/leapwallet.svg";
// import WalletconnectIcon from "@/assets/icons/wallets/walletconnect.svg";

import NolusIcon from "@/assets/icons/coins/nls.svg?url";

import { useWalletStore } from "../stores/wallet";
import { WalletConnectMechanism } from "../types";

const popoverParent = ref();
const isOpen = ref(false);
const wallet = useWalletStore();

const i18n = useI18n();
const type = WalletManager.getWalletConnectMechanism();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const emitter = defineEmits(["onDisconnect"]);

const connections: {
  [key: string]: {
    icon: FunctionalComponent | string;
    label: string;
  };
} = {
  [WalletConnectMechanism.KEPLR]: {
    icon: KeplrIcon,
    label: i18n.t("message.keplr")
  },
  [WalletConnectMechanism.LEAP]: {
    icon: LeapIcon,
    label: i18n.t("message.leap")
  },
  // [WalletConnectMechanism.WALLET_WC]: {
  //   icon: WalletconnectIcon,
  //   label: i18n.t("message.walletconnect")
  // },
  [WalletConnectMechanism.LEDGER]: {
    icon: LedgerIcon,
    label: i18n.t("message.ledger")
  },
  [WalletConnectMechanism.LEDGER_BLUETOOTH]: {
    icon: LedgerIcon,
    label: i18n.t("message.ledger")
  }
};
const connection = connections[type as keyof typeof WalletConnectMechanism];

function onClickDisconnect() {
  emitter("onDisconnect");
}

async function onCopy() {
  StringUtils.copyToClipboard(wallet?.wallet?.address ?? "");
  onShowToast({
    type: ToastType.success,
    message: i18n.t("message.address-coppied")
  });
}
</script>

<style lang="scss" scoped>
button {
  &.wallet-action {
    opacity: 0.5;
    transition: ease 200ms;
    &:hover {
      opacity: 0.8;
    }
    &:active {
      opacity: 1;
    }
  }
}
</style>
