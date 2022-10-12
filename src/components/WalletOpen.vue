<template>
  <div
    v-cloak
    id="wallet-nls"
    class="wallet-nls box-open bg-transparent shadow-modal c-navbar-wallet__container transition duration-3 ease-2"
  >
    <!-- Wallet Header -->
    <div
      class="box-open-header bg-white p-4 lg:p-6 border-b border-standart radius-top-left"
    >
      <h2 v-cloak class="nls-font-700 text-18 text-primary text-left m-0">
        {{ $t('message.your-wallet') }}
      </h2>
      <div class="flex grey-box items-center bg-light-grey radius-rounded">
        <span class="icon-wallet"></span>
        <span class="text-14 nls-font-400 text-primary">{{ $t('message.precious') }}</span>
      </div>
    </div>

    <!-- Wallet Body -->
    <div
      class="box-open-body bg-white p-4 lg:p-6 border-b border-standart text-left"
    >
      <!-- Language -->
      <!-- <div class="block">
        <Picker
          :default-option="{ label: 'English', value: 'en' }"
          :disabled="true"
          :options="[{ value: 'en', label: 'English' }]"
          label="Language"
        />
      </div> -->

      <div class="block">
        <Picker
          :default-option="{ label: 'USD', value: 'USD' }"
          :disabled="true"
          :options="[
            { value: 'USD', label: 'USD' },
            { value: 'EUR', label: 'EUR' },
          ]"
          label="Currency"
        />
      </div>

      <div class="block mt-3">
        <Picker
          :default-option="currentNetwork"
          :options="networks"
          label="Network"
          @focus="showWallet = true"
          @update-selected="onUpdateNetwork"
        />
      </div>
    </div>

    <!-- Wallet Actions -->
    <div class="box-open-actions p-4 lg:pr-6 bg-white">
      <div class="flex justify-end">
        <button
          class="btn btn-secondary btn-large-secondary"
          @click="onClickDisconnect"
        >
          {{ $t('message.disconnect') }}
        </button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import Picker, { type PickerOption } from '@/components/Picker.vue';
import router from '@/router';
import { onMounted, ref } from 'vue';
import { EnvNetworkUtils, StringUtils, WalletUtils } from '@/utils';
import { RouteNames } from '@/router/RouterNames';
import { WalletManager } from '@/wallet/WalletManager';
import { ApplicationActionTypes, useApplicationStore } from '@/stores/application';

const showWallet = ref(false);
const networks = ref([] as PickerOption[]);
const currentNetwork = ref({} as PickerOption);
const applicaton = useApplicationStore();

onMounted(() => {
  EnvNetworkUtils.getEnvNetworks().forEach((network) => {
    networks.value.push({
      label: StringUtils.capitalize(network),
      value: network,
    });
  });

  currentNetwork.value = {
    label: StringUtils.capitalize(EnvNetworkUtils.getStoredNetworkName() || ''),
    value: EnvNetworkUtils.getStoredNetworkName() || '',
  };
});

const handleFocusOut = () => {
  showWallet.value = false;
};

const onUpdateNetwork = (value: PickerOption) => {
  EnvNetworkUtils.saveCurrentNetwork(value.value);
  applicaton[ApplicationActionTypes.CHANGE_NETWORK](true);
};

const onClickDisconnect = () => {
  WalletManager.eraseWalletInfo();
  router.push({ name: RouteNames.AUTH });
};
</script>

<style scoped>
.icon-wallet {
  font-size: 2em !important;
  margin-right: 0 !important;
}

.bg-light-grey {
  background: #f7f9fc;
  margin-top: 11px;
}

.justify-content {
  justify-content: space-between !important;
}
</style>
