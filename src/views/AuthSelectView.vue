<template>
  <div class="block w-screen md:w-[516px] md:mt-auto h-full md:h-auto">
    <div class="background md:rounded-2xl rounded-t-2xl shadow-box md:filter-none outline h-full">
      <h1 class="text-28 md:text-32 nls-font-700 text-primary text-center pt-6 pb-5 relative z-[2]">
        {{ $t("message.connect-wallet") }}
      </h1>

      <div class="separator-line z-[100]"></div>

      <div class="flex px-4 md:px-10 pt-10 pb-2 relative z-[2] lg:pt-6">
        <button
          class="btn btn-box btn-large-box basis-0 grow auth"
          @click="clickConnectToKeplr"
        >
          <span class="icon icon-keplr ml-1"></span>
          {{ $t("message.keplr") }}
        </button>

        <!-- <button 
              class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow" 
              :class="{disabled: loadingGoogle}"
              @click="googleAuth()" 
            >
              <span class="icon icon-google"></span>
              {{ $t("message.google") }}
            </button> -->

        <button
          class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow auth"
          @click="clickImportLedger"
        >
          <span class="icon icon-ledger mb-[4px]"></span>
          {{ $t("message.ledger") }}
        </button>
      </div>

      <div class="flex px-4 md:px-10 pt-10 pb-6 relative z-[2] lg:pt-2">
        <button
          class="btn btn-box btn-large-box basis-0 grow auth"
          @click="clickConnectToLeap"
        >
          <span class="icon icon-leap ml-1"></span>
          {{ $t("message.leap") }}
        </button>
        <button
          class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow auth"
          @click="clickConnectToMetamask"
        >
          <span class="icon mb-[4px]"></span>
          {{ $t("message.metamask") }}
        </button>
      </div>

      <!-- <div class="flex mt-6 md:mt-5 px-4 md:px-10 relative z-[2]">
            <button
              class="btn btn-box btn-large-box mr-5 md:mr-4 basis-0 grow"
              @click="clickImportLedger"
            >
              <span class="icon icon-ledger"></span>
              {{ $t("message.ledger") }}
            </button>

            <button
              class="btn btn-box btn-large-box basis-0 grow"
              @click="clickImportSeed"
            >
              <span class="icon icon-recover"></span>
              {{ $t("message.recover") }}
            </button>
          </div> -->

      <!-- <div class="block separator-line nls-font-400 text-12 text-center mt-10 md:mt-7 mx-4 md:mx-10 md:mb-0 relative z-[2]"
          >
            <span class="background px-3 relative z-[2] text-primary">
              {{ $t("message.continue-with") }}
            </span>
          </div> -->

      <!-- <div class="background h-[420px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

          <div class="align-center justify-center pt-7 text-center mx-auto md:flex">
            <button
              class="btn btn-primary btn-large-primary w-80 mb-4 md:mb-10"
              :class="{'js-loading': loadingGoogle}"
              @click="clickCreateAccount"
            >
              {{ $t("message.create-new-account") }}
            </button>
            <div class="background h-[60px] relative md:hidden mt-[-62px] mx-[-2px]"></div>
          </div> -->
      <div class="px-4 md:px-10 pb-6 relative z-[2] text-dark-grey text-[13px]">
        By connecting a wallet, you acknowledge that you have read, agree and accept Nolus Protocol’s
        <button
          class="text-[#2868E1]"
          @click="onShowTermsModal"
        >Terms of Service</button>
      </div>
    </div>

    <!-- <div class="md:hidden flex align-center justify-center md:pt-7 pt-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal z-[100]">
          <button
            class="btn btn-primary btn-large-primary w-80 mb-4 lg:mb-10"
            :class="{'js-loading': loadingGoogle}"
            @click="clickCreateAccount"
          >
            {{ $t("message.create-new-account") }}
          </button>
        </div> -->
  </div>
  <Modal
    v-if="showTermsModal"
    @close-modal="showTermsModal = false"
    route="terms-of-service"
  >
    <TermsDialog></TermsDialog>
  </Modal>
</template>

<script setup lang="ts">
import Modal from "@/components/modals/templates/Modal.vue";
import TermsDialog from "@/components/modals/TermsDialog.vue";
import router from "@/router";
import { RouteNames } from "@/router/RouterNames";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { ref } from "vue";

const wallet = useWalletStore();
const loadingGoogle = ref(false);
const showTermsModal = ref(false);

const clickConnectToKeplr = () => {
  router.push({ name: RouteNames.CONNECT_KEPLR });
};

const clickConnectToLeap = () => {
  router.push({ name: RouteNames.CONNECT_LEAP });
}

const clickConnectToMetamask = () => {
  router.push({ name: RouteNames.CONNECT_METAMASK });
}

const clickImportLedger = () => {
  router.push({ name: RouteNames.IMPORT_LEDGER });
};

const onShowTermsModal = () => {
  showTermsModal.value = true;
}

const clickImportSeed = () => {
  router.push({ name: RouteNames.IMPORT_SEED });
};

const clickCreateAccount = () => {
  router.push({ name: RouteNames.CREATE_ACCOUNT });
};

const googleAuth = async () => {
  try {
    loadingGoogle.value = true;
    const res = await wallet[WalletActionTypes.CONNECT_GOOGLE]();
    if (res) {
      await router.push({ name: RouteNames.SET_PASSWORD });
    }
  } catch (error: Error | any) {
    loadingGoogle.value = false;
  }
};
</script>
<style scoped lang="scss">
.fake-button {
  font-size: 14px;
  padding: 19px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>