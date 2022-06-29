<template>
  <button
    class="show-box-wallet btn btn-header with-icon shadow-box rounded-r-none"
    @click="togglePopup"
  >
    <span
      class="icon-wallet mr-0"
      style="font-size: 1.5em !important; margin-right: 0"
    ></span>
    <span class="nls-13 nls-font-400 text-primary">My precious</span>
  </button>
  <div
    :class="showWalletPopup ? 'active' : false"
    class="box-open bg-transparent shadow-modal c-navbar-wallet__container transition duration-3 ease-2"
  >
    <!-- Wallet Header -->
    <div
      class="box-open-header bg-white p-4 lg:p-6 border-b border-standart radius-top-left"
    >
      <h2 class="nls-font-700 nls-18 text-primary text-left m-0">
        Your Wallet
      </h2>
      <div
        class="flex grey-box py-nolus-10 items-center bg-light-grey radius-rounded"
      >
        <span class="icon-wallet"></span>
        <span class="nls-14 nls-font-400 text-primary">My precious</span>
      </div>
    </div>

    <!-- Wallet Body -->
    <div
      class="box-open-body bg-white p-4 lg:p-6 border-b border-standart text-left"
    >
      <DynamicForm :formValue="walletData" />
      <div class="block">
        <PickerDefault
          label="Language"
          :default-option="{ label: 'English', value: 'en' }"
          :options="[{ value: 'en', label: 'English' }]"
          :disabled="true"
        />
      </div>

      <div class="block mt-3">
        <PickerDefault
          label="Currency"
          :default-option="{ label: 'USD', value: 'USD' }"
          :options="[
            { value: 'USD', label: 'USD' },
            { value: 'EUR', label: 'EUR' },
          ]"
          :disabled="true"
        />
      </div>

      <div class="block mt-3">
        <PickerDefault
          label="Network"
          :default-option="this.currentNetwork"
          :options="this.networks"
          @update-selected="onUpdateNetwork"
        />
      </div>
    </div>

    <!-- Wallet Actions -->
    <div class="box-open-actions p-4 lg:p-6 bg-white">
      <div class="flex justify-end">
        <button class="btn btn-secondary btn-large-secondary">
          Disconnect
        </button>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import PickerDefault, {
  PickerDefaultOption,
} from "@/components/PickerDefault.vue";
import { defineComponent, PropType } from "vue";
import { EnvNetworks } from "@/config/envNetworks";
import { StringUtils } from "@/utils/StringUtils";
import { useStore } from "@/store";
import { ApplicationActionTypes } from "@/store/modules/application/action-types";
import { WalletManager } from "@/config/wallet";
import router from "@/router";
import { RouteNames } from "@/router/RouterNames";
import { WalletUtils } from "@/utils/WalletUtils";

export default defineComponent({
  name: "WalletOpen",
  components: {
    PickerDefault,
  },

  props: [],
  data() {
    return {
      showWalletPopup: false,
      networks: [] as PickerDefaultOption[],
      currentNetwork: {} as PickerDefaultOption,
    };
  },
  mounted() {
    const envNetwork = new EnvNetworks();
    envNetwork.getEnvNetworks().forEach((network) => {
      this.networks.push({
        label: StringUtils.capitalize(network),
        value: network,
      });
    });
    console.log("curr: ", envNetwork.getStoredNetworkName());
    this.currentNetwork = {
      label: StringUtils.capitalize(envNetwork.getStoredNetworkName() || ""),
      value: envNetwork.getStoredNetworkName() || "",
    };
  },

  methods: {
    togglePopup() {
      this.showWalletPopup = !this.showWalletPopup;
    },
    onUpdateNetwork(value: PickerDefaultOption) {
      console.log("loggg");
      EnvNetworks.saveCurrentNetwork(value.value);
      if (WalletUtils.isConnectedViaExtension()) {
        useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK);
      }
    },
    onClickDisconnect() {
      WalletManager.eraseWalletInfo();
      router.push({ name: RouteNames.AUTH });
    },
  },
});
</script>

<style scoped>
.icon-wallet {
  font-size: 2em !important;
  margin-right: 0 !important;
}

.bg-light-grey {
  background: #f7f9fc;
  padding: 14px 11px;
  margin-top: 11px;
}
.justify-content {
  justify-content: space-between !important;
}
</style>
