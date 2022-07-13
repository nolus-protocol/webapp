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
      <h2 v-cloak class="nls-font-700 nls-18 text-primary text-left m-0">
        Your Wallet
      </h2>
      <div class="flex grey-box items-center bg-light-grey radius-rounded">
        <span class="icon-wallet"></span>
        <span class="nls-14 nls-font-400 text-primary">My precious</span>
      </div>
    </div>

    <!-- Wallet Body -->
    <div
      class="box-open-body bg-white p-4 lg:p-6 border-b border-standart text-left"
    >
      <div class="block">
        <Picker
          :default-option="{ label: 'English', value: 'en' }"
          :disabled="true"
          :options="[{ value: 'en', label: 'English' }]"
          label="Language"
        />
      </div>

      <div class="block mt-3">
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
          :default-option="this.currentNetwork"
          :options="this.networks"
          label="Network"
          @focus="showWallet = true"
          @update-selected="onUpdateNetwork"
        />
      </div>
    </div>

    <!-- Wallet Actions -->
    <div class="box-open-actions p-4 lg:p-6 bg-white">
      <div class="flex justify-end">
        <button
          class="btn btn-secondary btn-large-secondary"
          v-on:click="onClickDisconnect"
        >
          Disconnect
        </button>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import Picker, { PickerOption } from '@/components/Picker.vue'
import { StringUtils } from '@/utils/StringUtils'
import { useStore } from '@/store'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'
import router from '@/router'
import { RouteNames } from '@/router/RouterNames'
import { WalletUtils } from '@/utils/WalletUtils'
import { WalletManager } from '@/wallet/WalletManager'

export default defineComponent({
  name: 'WalletOpen',
  components: {
    Picker
  },

  props: [],
  data () {
    return {
      showWallet: false,
      networks: [] as PickerOption[],
      currentNetwork: {} as PickerOption
    }
  },

  mounted () {
    const envNetwork = new EnvNetworkUtils()
    envNetwork.getEnvNetworks().forEach((network) => {
      this.networks.push({
        label: StringUtils.capitalize(network),
        value: network
      })
    })
    console.log('curr: ', envNetwork.getStoredNetworkName())
    this.currentNetwork = {
      label: StringUtils.capitalize(envNetwork.getStoredNetworkName() || ''),
      value: envNetwork.getStoredNetworkName() || ''
    }
  },

  methods: {
    handleFocusOut () {
      // alert("j");
      this.showWallet = false
    },
    onUpdateNetwork (value: PickerOption) {
      console.log('loggg')
      EnvNetworkUtils.saveCurrentNetwork(value.value)
      if (WalletUtils.isConnectedViaExtension()) {
        useStore().dispatch(ApplicationActionTypes.CHANGE_NETWORK)
      }
    },
    onClickDisconnect () {
      WalletManager.eraseWalletInfo()
      router.push({ name: RouteNames.AUTH })
    }
  }
})
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
