<template>
  <div v-if="isCreateFormOpen">
    <div
      class="block rounded-2xl bg-white -mt-8 md:mt-auto pb-10 pt-6 border border-standart shadow-box md:max-w-[516px]">
      <h1 class="text-to-big-number text-primary text-28 md:text-32 text-center relative">
        <button class="align-baseline absolute left-0 top-2/4 -mt-3 px-6 md:px-10" type="button" @click="clickBack">
          <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
        </button>
        <span class="inline-block align-baseline text-28 md:text-32 relative z-[2]">
          {{ $t("message.create-wallet") }}
        </span>
      </h1>

      <div class="separator-line p-6 relative z-[2]"></div>

      <div class="px-4 md:px-10">
        <TextFieldButtons 
          class="relative z-[2]" 
          name="mnemonicSeed" 
          id="mnemonicSeed" 
          :label="$t('message.seed')"
          :value="mnemonic" 
          :on-click-copy="onClickCopy" 
          :on-click-print="onClickPrint">
        </TextFieldButtons>

        <div class="flex rounded p-4 warning-box mt-8 md:mt-6 relative z-[2]">
          <div class="inline-block mr-2">
            <img src="@/assets/icons/warning.svg" />
          </div>
          <div class="inline-block flex-1">
            <p class="text-primary nls-font-700 text-14">
              {{ $t("message.backup-seed-bold") }}
              <span class="text-primary text-14 nls-font-400">
                {{ $t("message.backup-seed") }}
              </span>
            </p>
          </div>
        </div>

        <div class="block mt-6 sm:color-white">
          <button class="btn btn-primary btn-large-primary" @click="btnContinueToConfirm">
            {{ $t("message.continue") }}
          </button>
        </div>

        <div class="bg-white h-[420px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

        <div
          class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal">
          <button class="btn btn-primary btn-large-primary w-80" @click="btnContinueToConfirm">
            {{ $t("message.continue") }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="md:max-w-[516px]">
    <div class="block rounded-2xl bg-white -mt-8 md:mt-auto pb-10 pt-6 border border-standart shadow-box">
      <h1 class="text-to-big-number text-primary text-center relative md:max-w-[516px]">
        <button class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10" type="button" @click="clickBack">
          <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
        </button>
        <span class="inline-block align-baseline text-28 md:text-32">
          {{ $t("message.confirm-seed") }}
        </span>
      </h1>

      <div class="separator-line p-6"></div>

      <SelectorTextField 
        ref="selector" 
        class="px-4 md:px-10" 
        id="confirm-mnemonic" 
        :on-click-confirm="confirmMnemonic"
        :values="mnemonicWords" 
        :label="$t('message.confirm-mnemonic')">
      </SelectorTextField>
    </div>
  </div>

  <Modal v-if="showErrorModal" @close-modal="showErrorModal = false">
    <ErrorDialog 
      :title="$t('message.error-connecting')" 
      :message="errorMessage" 
      :try-button="clickTryAgain" 
    />
  </Modal>
</template>

<script setup lang="ts">
import TextFieldButtons from '@/components/TextFieldButtons.vue';
import SelectorTextField from '@/components/SelectorTextField.vue';
import router from '@/router';
import ErrorDialog from '@/components/modals/ErrorDialog.vue';
import Modal from '@/components/modals/templates/Modal.vue';

import { onMounted, ref, type Ref } from 'vue';
import { ArrowLeftIcon } from '@heroicons/vue/24/solid';
import { KeyUtils } from '@nolus/nolusjs';
import { StringUtils } from '@/utils';
import { useI18n } from 'vue-i18n';
import { RouteNames } from '@/router/RouterNames';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';

const isCreateFormOpen = ref(true);
const mnemonic = ref('');
const mnemonicWords = ref([] as string[]);
const showErrorModal = ref(false);
const errorMessage = ref('');
const i18n = useI18n();
const selector: Ref<typeof SelectorTextField> = ref(SelectorTextField);
const wallet = useWalletStore();

onMounted(() => {
  mnemonic.value = KeyUtils.generateMnemonic();
  const words = mnemonic.value.split(' ');
  for (let i = 0; i < words.length; i++) {
    words[i] = words[i].trim();
  }
  words.sort((word1, word2) => {
    return word1 > word2 ? 1 : -1;
  });
  mnemonicWords.value = words;
});

const btnContinueToConfirm = () => {
  isCreateFormOpen.value = false;
};

const btnBackToCreateMnemonic = () => {
  isCreateFormOpen.value = true;
};

const onClickCopy = () => {
  StringUtils.copyToClipboard(mnemonic.value);
};

const onClickPrint = () => {
  const printWindow = window.open();
  printWindow?.document.open('text/plain');
  printWindow?.document.write(mnemonic.value);
  printWindow?.document.close();
  printWindow?.focus();
  printWindow?.print();
  printWindow?.close();
};

const clickBack = () => {
  if (isCreateFormOpen.value) {
    router.replace({ name: RouteNames.AUTH });
    return;
  }
  isCreateFormOpen.value = true;
};

const clickTryAgain = () => {
  showErrorModal.value = false;
  errorMessage.value = '';
  selector?.value?.onRefresh();
};

const confirmMnemonic = async (value: string[]) => {
  let confirmMnemonic = '';
  value.forEach((word) => {
    confirmMnemonic += ' ' + word;
  });

  if (mnemonic.value.trim() !== confirmMnemonic.trim()) {
    showErrorModal.value = true;
    errorMessage.value = i18n.t('message.mnemonic-error');
    return;
  }

  try {
    await wallet[WalletActionTypes.CONNECT_VIA_MNEMONIC](mnemonic.value);
    mnemonic.value = '';
    await router.push({ name: RouteNames.SET_PASSWORD });
  } catch (e: Error | any) {
    showErrorModal.value = true;
    errorMessage.value = e?.message;
  }

};

</script>
