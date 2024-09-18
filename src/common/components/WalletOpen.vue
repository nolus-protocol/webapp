<template>
  <div
    id="wallet-nls"
    class="wallet-nls box-open c-navbar-wallet__container bg-transparent outline"
  >
    <!-- Wallet Header -->
    <div class="box-open-header background border-standart radius-top-left border-b p-4 lg:p-6">
      <h2 class="m-0 text-left text-18 font-semibold text-neutral-typography-200">
        {{ $t("message.your-wallet") }}
      </h2>
      <div
        class="grey-box modal-balance radius-rounded copy-button mt-3 flex items-center justify-between px-2"
        @click="onCopy()"
      >
        <span class="ml-2 text-14 font-normal text-neutral-typography-200">
          {{ getWallet }}
        </span>
        <span
          v-if="showText"
          class="copy-text"
          >{{ $t("message.copied") }}</span
        >

        <img
          v-else
          class="copy-icon"
          height="21"
          src="@/assets/icons/copy-gray.svg"
          width="21"
        />
      </div>
    </div>

    <!-- Wallet Body -->
    <div class="box-open-body background border-standart border-b p-4 text-left lg:p-6">
      <div class="block">
        <Picker
          :default-option="selectedLang"
          :disable-input="true"
          :label="$t('message.language')"
          :options="langs"
          @update-selected="setLanguage"
        />
      </div>

      <div class="mt-3 block">
        <Picker
          :default-option="selectedAppearnce"
          :disable-input="true"
          :label="$t('message.appearance')"
          :options="appearance"
          @update-selected="onUpdateTheme"
        />
      </div>

      <div
        v-if="AppUtils.isDev()"
        class="mt-3 block"
      >
        <Picker
          :default-option="currentNetwork"
          :disable-input="true"
          :label="$t('message.network')"
          :options="networks"
          @focus="showWallet = true"
          @update-selected="onUpdateNetwork"
        />
      </div>
    </div>

    <!-- Wallet Actions -->
    <div class="box-open-actions background p-8 lg:pr-8">
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
<script lang="ts" setup>
import Picker, { type PickerOption } from "@/common/components/Picker.vue";
import { RouteNames, router } from "@/router";
import { computed, inject, onMounted, onUnmounted, ref } from "vue";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { APPEARANCE, languages } from "@/config/global";
import { useI18n } from "vue-i18n";
import { ApplicationActions, useApplicationStore } from "@/common/stores/application";
import { AppUtils, EnvNetworkUtils, StringUtils, ThemeManager, WalletManager } from "@/common/utils";
import { setLang } from "@/i18n";

let timeOut: NodeJS.Timeout;
const showWallet = ref(false);
const currentNetwork = ref({} as PickerOption);
const applicaton = useApplicationStore();
const wallet = useWalletStore();

const i18n = useI18n();
const showText = ref(false);
const themeData = ThemeManager.getThemeData();
const lang = AppUtils.getLang();
const toggle = inject("toggle", () => {});

const selectedAppearnce = ref({
  label: i18n.t(`message.${themeData}`),
  value: themeData
});

const selectedLang = {
  label: lang.label,
  value: lang.key
};

const appearance = ref(
  Object.keys(APPEARANCE).map((key) => {
    return {
      value: APPEARANCE[key as keyof typeof APPEARANCE],
      label: i18n.t(`message.${key}`)
    };
  })
);

const langs = ref(
  Object.keys(languages).map((key) => {
    return {
      value: languages[key as keyof typeof languages].key,
      label: languages[key as keyof typeof languages].label
    };
  })
);

const getWallet = computed(() => {
  return StringUtils.truncateString(wallet.wallet?.address ?? WalletManager.getWalletAddress(), 12, 8);
});

const networks = ref(
  EnvNetworkUtils.getEnvNetworks().map((network) => {
    return {
      label: StringUtils.capitalize(network),
      value: network
    };
  }) as PickerOption[]
);

onMounted(() => {
  currentNetwork.value = {
    label: StringUtils.capitalize(EnvNetworkUtils.getStoredNetworkName() || ""),
    value: EnvNetworkUtils.getStoredNetworkName() || ""
  };
});

onUnmounted(() => {
  clearTimeout(timeOut);
});

async function onUpdateNetwork(value: PickerOption) {
  EnvNetworkUtils.saveCurrentNetwork(value.value);
  window.location.replace("/");
}

function onUpdateTheme(item: PickerOption) {
  ThemeManager.saveThemeData(item.value);
  applicaton[ApplicationActions.SET_THEME](item.value);
}

async function onClickDisconnect() {
  router.push({ name: RouteNames.DASHBOARD });
  toggle();
  WalletManager.eraseWalletInfo();
  wallet[WalletActions.DISCONNECT]();
  await applicaton[ApplicationActions.CHANGE_NETWORK]();
}

async function setLanguage(item: PickerOption) {
  AppUtils.setLang(item.value);
  await setLang(item.value);
  appearance.value = Object.keys(APPEARANCE).map((key) => {
    return {
      value: APPEARANCE[key as keyof typeof APPEARANCE],
      label: i18n.t(`message.${key}`)
    };
  });
  selectedAppearnce.value = {
    label: i18n.t(`message.${themeData}`),
    value: themeData
  };
}

function onCopy() {
  showText.value = true;
  StringUtils.copyToClipboard(wallet?.wallet?.address ?? "");
  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    showText.value = false;
  }, 2000);
}
</script>

<style scoped>
#wallet-nls {
  overflow: hidden;
  box-shadow: 0 16px 16px 4px rgba(7, 45, 99, 0.06);
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
