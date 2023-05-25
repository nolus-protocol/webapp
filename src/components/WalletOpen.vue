<template>
  <div
    id="wallet-nls"
    class="wallet-nls box-open bg-transparent shadow-modal c-navbar-wallet__container outline"
  >
    <!-- Wallet Header -->
    <div class="box-open-header background p-4 lg:p-6 border-b border-standart radius-top-left">
      <h2 class="nls-font-700 text-18 text-primary text-left m-0">
        {{ $t("message.your-wallet") }}
      </h2>
      <div
        class="flex grey-box items-center modal-balance mt-3 radius-rounded justify-between px-2 copy-button"
        @click="onCopy()"
      >
        <span class="text-14 nls-font-400 dark-text ml-2">
          {{ getWallet }}
        </span>
        <span
          class="copy-text"
          v-if="showText"
        >{{
          $t("message.copied")
        }}</span>
        <img
          class="copy-icon"
          v-else
          src="@/assets/icons/copy-gray.svg"
          width="21"
          height="21"
        />
      </div>
    </div>

    <!-- Wallet Body -->
    <div v-if="ApptUtils.isDev()" class="box-open-body background p-4 lg:p-6 border-b border-standart text-left">
      <div class="block">
        <Picker
          :default-option="selectedAppearnce"
          :options="appearance"
          :label="$t('message.appearance')"
          @update-selected="onUpdateTheme"
        />
      </div>

      <div class="block mt-3">
        <Picker
          :default-option="currentNetwork"
          :options="networks"
          :label="$t('message.network')"
          @focus="showWallet = true"
          @update-selected="onUpdateNetwork"
        />
      </div>
    </div>

    <!-- Wallet Actions -->
    <div class="box-open-actions p-8 lg:pr-8 background">
      <div class="flex justify-end">
        <button
          class="btn btn-secondary btn-large-secondary"
          @click="onClickDisconnect"
        >
          {{ $t("message.disconnect") }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import Picker, { type PickerOption } from "@/components/Picker.vue";
import router from "@/router";
import { onMounted, ref, computed, onUnmounted } from "vue";
import { RouteNames } from "@/router/RouterNames";
import { useWalletStore } from "@/stores/wallet";
import { APPEARANCE } from "@/config/env";
import { useI18n } from "vue-i18n";
import { ApplicationActionTypes, useApplicationStore } from "@/stores/application";
import { EnvNetworkUtils, StringUtils, ThemeManager, WalletManager } from "@/utils";
import { ApptUtils } from "@/utils/AppUtils";

let timeOut: NodeJS.Timeout;
const showWallet = ref(false);
const currentNetwork = ref({} as PickerOption);
const applicaton = useApplicationStore();
const wallet = useWalletStore();
const i18n = useI18n();
const showText = ref(false);
const themeData = ThemeManager.getThemeData();

const selectedAppearnce = {
  label: i18n.t(`message.${themeData}`),
  value: themeData,
};

const appearance = computed(() => {
  const items = [];
  for (const key in APPEARANCE) {
    items.push({
      value: APPEARANCE[key as keyof typeof APPEARANCE],
      label: i18n.t(`message.${key}`),
    });
  }
  return items;
});

const getWallet = computed(() => {
  return StringUtils.truncateString(wallet.wallet?.address ?? WalletManager.getWalletAddress(), 12, 8);
});

const networks = ref(
  EnvNetworkUtils.getEnvNetworks().map((network) => {
    return {
      label: StringUtils.capitalize(network),
      value: network,
    };
  }) as PickerOption[]
);

onMounted(() => {
  currentNetwork.value = {
    label: StringUtils.capitalize(EnvNetworkUtils.getStoredNetworkName() || ""),
    value: EnvNetworkUtils.getStoredNetworkName() || "",
  };
});

onUnmounted(() => {
  clearTimeout(timeOut);
});

async function onUpdateNetwork(value: PickerOption) {
  
  EnvNetworkUtils.saveCurrentNetwork(value.value);
  applicaton[ApplicationActionTypes.CHANGE_NETWORK](true);
  applicaton[ApplicationActionTypes.LOAD_APR_REWARDS]();
  router.push({ name: RouteNames.DASHBOARD });
};

function onUpdateTheme(item: PickerOption) {
  ThemeManager.saveThemeData(item.value);
  applicaton[ApplicationActionTypes.SET_THEME](item.value);
};

function onClickDisconnect() {
  WalletManager.eraseWalletInfo();
  router.push({ name: RouteNames.AUTH });
};

function onCopy() {
  showText.value = true;
  StringUtils.copyToClipboard(wallet?.wallet?.address ?? "");
  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    showText.value = false;
  }, 2000);
};
</script>

<style scoped>
#wallet-nls {
  overflow: hidden;
}

.icon-wallet {
  font-size: 2em !important;
  margin-right: 0 !important;
  color: #8396b1;
}

.bg-light-grey {
  background: #f7f9fc;
  margin-top: 11px;
}

.gray-color {
  color: #8396b1;
}

.justify-content {
  justify-content: space-between !important;
}

img.copy-icon {
  pointer-events: none;
  margin-right: 4px;
}

span.copy-text {
  font-size: 13px !important;
  margin-right: 4px;
  color: #8396b1;
}

div.copy-button {
  cursor: pointer;
  user-select: none;
  height: 32px;
  align-items: center;
}
</style>
