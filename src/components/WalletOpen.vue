<template>
  <div
    id="wallet-nls"
    class="wallet-nls box-open bg-transparent shadow-modal c-navbar-wallet__container transition duration-3 ease-2 border nls-border outline"
  >
    <!-- Wallet Header -->
    <div
      class="box-open-header background p-4 lg:p-6 border-b border-standart radius-top-left"
    >
      <h2 class="nls-font-700 text-18 text-primary text-left m-0">
        {{ $t('message.your-wallet') }}
      </h2>
      <div class="flex grey-box items-center modal-balance mt-3 radius-rounded">
        <span class="icon-wallet"></span>
        <span class="text-14 nls-font-400 dark-text">{{ wallet.walletName }}</span>
      </div>
    </div>

    <!-- Wallet Body -->
    <div class="box-open-body background p-4 lg:p-6 border-b border-standart text-left">

      <div class="block">
        <Picker
          :default-option="{ label: 'USD', value: 'USD' }"
          :disabled="true"
          :options="[
            { value: 'USD', label: 'USD' },
          ]"
          :label="$t('message.currency')"
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
import { EnvNetworkUtils, StringUtils } from '@/utils';
import { RouteNames } from '@/router/RouterNames';
import { WalletManager } from '@/wallet/WalletManager';
import { ApplicationActionTypes, useApplicationStore } from '@/stores/application';
import { useWalletStore } from '@/stores/wallet';

const showWallet = ref(false);
const currentNetwork = ref({} as PickerOption);
const applicaton = useApplicationStore();
const wallet = useWalletStore();

const networks = ref(EnvNetworkUtils.getEnvNetworks().map((network) => {
  return {
    label: StringUtils.capitalize(network),
    value: network,
  };
}) as PickerOption[]);

onMounted(() => {
  currentNetwork.value = {
    label: StringUtils.capitalize(EnvNetworkUtils.getStoredNetworkName() || ''),
    value: EnvNetworkUtils.getStoredNetworkName() || '',
  };
});

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
#wallet-nls{
  overflow: hidden;
}
.icon-wallet {
  font-size: 2em !important;
  margin-right: 0 !important;
  color: #8396B1;
}

.bg-light-grey {
  background: #f7f9fc;
  margin-top: 11px;
}

.justify-content {
  justify-content: space-between !important;
}
</style>
