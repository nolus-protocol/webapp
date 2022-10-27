<template>
  <div
    class="block rounded-2xl background md:pb-10 pt-6 pb-[300px] -mt-8 md:mt-auto md:border nls-border shadow-box w-screen md:w-[516px]"
  >
    <h1 class="text-to-big-number text-primary text-center relative relative z-[2]">
      <button
        class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10"
        type="button"
        @click="clickBack"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
      </button>
      <span class="inline-block align-baseline text-28 md:text-32">
        {{ $t("message.set-password") }}
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <InputField
      class="px-4 md:px-10 relative z-[2]"
      id="password"
      v-model:value.trim="password"
      :error-msg="errorMessage"
      :is-error="errorMessage !== ''"
      :label="$t('message.password')"
      name="password"
      type="password"
    ></InputField>

    <InputField
      class="px-4 md:px-10 relative z-[2] mt-4"
      id="confirm-password"
      v-model:value.trim="confirmPassword"
      :error-msg="confirmErrorMessage"
      :is-error="confirmErrorMessage !== ''"
      :label="$t('message.confirm-password')"
      name="confirmPassword"
      type="password"
    ></InputField>

    <div class="mt-6 px-4 md:px-10 hidden md:flex">
      <button class="btn btn-primary btn-large-primary" @click="clickContinue">
        {{ $t("message.continue") }}
      </button>
    </div>

    <div
      class="background h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"
    ></div>

    <div
      class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal"
    >
      <button
        class="btn btn-primary btn-large-primary w-80"
        @click="clickContinue"
      >
        {{ $t("message.continue") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import router from '@/router';
import InputField from '@/components/InputField.vue';
import { ArrowLeftIcon } from '@heroicons/vue/24/solid';

import { ref, watch } from 'vue';
import { RouteNames } from '@/router/RouterNames';
import { useI18n } from 'vue-i18n';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';

const password = ref('');
const confirmPassword = ref('');

const errorMessage = ref('');
const confirmErrorMessage = ref('');
const i18n = useI18n();
const walletStore = useWalletStore();
const minLength = 8;
const specialSymbols = "-!$%^&*()_+|~=`{}\[\]:\/;<>?,.@#";

const clickBack = () => {
  router.replace({ name: RouteNames.IMPORT_SEED });
};

const clickContinue = () => {

  if(validate()){
    return false;
  }

  errorMessage.value = '';
  confirmErrorMessage.value = '';
  walletStore[WalletActionTypes.STORE_PRIVATE_KEY](password.value);
  checkBalances();
  router.push({ name: RouteNames.DASHBOARD });
};

const checkBalances = async () => {
  try{
    await walletStore[WalletActionTypes.UPDATE_BALANCES]();
  }catch(error){
    console.log(error);
  }
}

const validate = () => {
  const password = validatePassword();
  const confirm = validateConfirmPassword();
  return password || confirm;
}

const validatePassword = () => {
  if (password.value === '') {
    errorMessage.value = i18n.t('message.password-error');
    return true;
  }

  if (password.value.length < minLength) {
    errorMessage.value = i18n.t('message.password-length-error', {length: minLength});
    return true;
  }

  const hasNumber = /\d/.test(password.value);

  if(!hasNumber){
    errorMessage.value = i18n.t('message.password-number-error');
    return true;
  }

  const hasUpper = /[A-Z]/.test(password.value);

  if(!hasUpper){
    errorMessage.value = i18n.t('message.password-upper-error');
    return true;
  }

  const hasLower = /[a-z]/.test(password.value);

  if(!hasLower){
    errorMessage.value = i18n.t('message.password-lower-error');
    return true;
  }

  const specialSymbol = /[-!$%^&*()_+|~=`{}\[\]:\/;<>?,.@#]/.test(password.value);
  if(!specialSymbol){
    errorMessage.value = i18n.t('message.password-special-symbol-error', { symbols: specialSymbols });
    return true;
  }

  return false;
}

const validateConfirmPassword = () => {
  if (confirmPassword.value === '') {
    confirmErrorMessage.value = i18n.t('message.confirm-password-error');
    return true;
  }
  if (confirmPassword.value != password.value) {
    confirmErrorMessage.value = i18n.t('message.password-mismatch-error');
    return true;
  }

  return false;
}

watch(password, () => {
  if(!validatePassword()){
    errorMessage.value = '';
  }
});

watch(confirmPassword, () => {
  if(!validateConfirmPassword()){
    confirmErrorMessage.value = '';
  }
});

</script>
