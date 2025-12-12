<template>
  <div class="flex flex-col gap-6 p-4">
    <Dropdown
      id="header"
      :label="$t('message.network')"
      :options="options"
      :selected="option"
      :on-select="onSelect"
    />
    <Dropdown
      id="language"
      :label="$t('message.language')"
      :options="languagesOptions"
      :on-select="setLanguage"
      :selected="selectedLang"
    />
    <div class="flex flex-col gap-4 text-typography-default">
      <span class="text-16">{{ $t("message.appearance") }}</span>
      <div class="flex gap-4">
        <div
          v-for="(theme, index) of appearance"
          @click="onUpdateTheme(theme.value)"
          :key="index"
          class="flex cursor-pointer flex-col gap-1"
        >
          <div
            class="rounded-lg border border-transparent bg-info-muted"
            :class="[{ '!border-icon-link': selectedAppearance.value === theme.value }]"
          >
            <component :is="theme.image" />
          </div>
          <span class="block text-center text-14 font-semibold">{{ theme.label }}</span>
        </div>
      </div>
    </div>
    <!-- <div class="flex gap-2 text-typography-default">
      <p class="flex-1">Include exchange fees in PnL</p>
      <Toggle
        label="On"
        id="theme-toggle"
      />
    </div> -->
  </div>
</template>

<script lang="ts" setup>
import { h, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { type DropdownOption, Dropdown, Size } from "web-components";
import { WalletManager } from "@/common/utils";
import { useOracleStore } from "@/common/stores/oracle";

import { setLang } from "@/i18n";
import { APPEARANCE, languages } from "@/config/global";
import { AppUtils, ThemeManager } from "@/common/utils";
import { ApplicationActions, useApplicationStore } from "@/common/stores/application";
import { useRouter } from "vue-router";
import { Contracts } from "@/config/global";

import DarkIcon from "@/assets/icons/theme/dark.svg";
import LightIcon from "@/assets/icons/theme/light.svg";
import SyncIcon from "@/assets/icons/theme/sync.svg";

const i18n = useI18n();
const lang = AppUtils.getLang();
const themeData = ThemeManager.getThemeData();
const application = useApplicationStore();
const oracle = useOracleStore();
const router = useRouter();

const selectedAppearance = ref({
  label: i18n.t(`message.${themeData}`),
  value: themeData
});

const selectedLang = {
  label: lang.label,
  value: lang.key
};

const ThemeIcons = {
  dark: h(DarkIcon),
  light: h(LightIcon),
  sync: h(SyncIcon)
};

const options = Object.keys(Contracts.protocolsFilter).map((item) => {
  const protocol = Contracts.protocolsFilter[item];
  return {
    value: protocol.key,
    label: protocol.name,
    icon: protocol.image
  };
});
const option = options.find((item) => item.value == WalletManager.getProtocolFilter());

const languagesOptions = ref(
  Object.keys(languages).map((key) => {
    return {
      value: languages[key as keyof typeof languages].key,
      label: languages[key as keyof typeof languages].label
    };
  })
);

const appearance = ref(
  Object.keys(APPEARANCE).map((key) => {
    return {
      image: ThemeIcons[key as keyof typeof ThemeIcons],
      value: APPEARANCE[key as keyof typeof APPEARANCE],
      label: i18n.t(`message.${key}`)
    };
  })
);

function onUpdateTheme(theme: string) {
  ThemeManager.saveThemeData(theme);
  application[ApplicationActions.SET_THEME](theme);
}

watch(
  () => application.theme,
  (value) => {
    selectedAppearance.value = {
      label: i18n.t(`message.${value}`),
      value: `${value}`
    };
  }
);

async function setLanguage(item: DropdownOption) {
  AppUtils.setLang(`${item.value}`);
  await setLang(`${item.value}`);

  appearance.value = Object.keys(APPEARANCE).map((key) => {
    return {
      image: ThemeIcons[key as keyof typeof ThemeIcons],
      value: APPEARANCE[key as keyof typeof APPEARANCE],
      label: i18n.t(`message.${key}`)
    };
  });

  selectedAppearance.value = {
    label: i18n.t(`message.${themeData}`),
    value: themeData
  };
}

async function onSelect(item: { value: string; label: string; icon: string }) {
  application.setProtcolFilter(item.value);
  await oracle.GET_PRICES();
  router.push("/");
}
</script>

<style scoped lang=""></style>
