<template>
  <form
    @submit.prevent="clickContinue"
    class="block rounded-2xl background md:pb-10 pt-6 pb-[300px] -mt-8 md:mt-auto md:border nls-border shadow-box w-screen md:w-[516px] outline"
  >
    <h1 class="text-to-big-number text-primary text-center relative relative z-[2]">
      <button
        class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10"
        type="button"
        @click="clickBack"
      >
        <ArrowLeftIcon
          aria-hidden="true"
          class="h-6 w-6"
        />
      </button>
      <span class="inline-block align-baseline text-28 md:text-32">
        {{ $t("message.set-name") }}
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <InputField
      class="px-4 md:px-10 relative z-[2]"
      id="wallet-name"
      v-model:value.trim="walletName"
      :error-msg="errorMessage"
      :is-error="errorMessage !== ''"
      :label="$t('message.wallet-name')"
      name="wallet-name"
      type="text"
    >
    </InputField>

    <div class="mt-6 px-4 md:px-10 md:flex">
      <button class="btn btn-primary btn-large-primary">
        {{ $t("message.done") }}
      </button>
      <div class="background h-[60px] relative md:hidden mt-[-50px] mx-[-2px]"></div>
    </div>

    <div Class="background h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

    <div
      class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal"
    >
      <button class="btn btn-primary btn-large-primary w-80">
        {{ $t("message.done") }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import router from "@/router";
import InputField from "@/components/InputField.vue";
import { ArrowLeftIcon } from "@heroicons/vue/24/solid";

import { ref, watch } from "vue";
import { RouteNames } from "@/router/RouterNames";
import { useI18n } from "vue-i18n";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { WalletManager } from "@/utils";

const walletName = ref("");
const errorMessage = ref("");
const i18n = useI18n();
const walletStore = useWalletStore();

function clickBack() {
  router.replace({ name: RouteNames.AUTH });
};

function clickContinue() {
  if (validateWalletName()) {
    return false;
  }
  WalletManager.setWalletName(walletName.value);
  walletStore[WalletActionTypes.LOAD_WALLET_NAME]();

  errorMessage.value = "";
  checkBalances();
  router.push({ name: RouteNames.DASHBOARD });
};

async function checkBalances() {
  try {
    await walletStore[WalletActionTypes.UPDATE_BALANCES]();
  } catch (error) {
    console.log(error);
  }
};

function validateWalletName() {
  if (walletName.value === "") {
    errorMessage.value = i18n.t("message.password-error");
    return true;
  }

  return false;
};

watch(walletName, () => {
  if (!validateWalletName()) {
    errorMessage.value = "";
  }
});
</script>
